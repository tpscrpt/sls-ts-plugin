import * as path from "path";
import * as fse from "fs-extra";
import * as _ from "lodash";
import globby from "globby";

import { ServerlessTSInstance, ServerlessTSOptions, ServerlessTSFunction } from "./types";
import { extractFileNames, getTypescriptConfig, run, getSourceFiles } from "./utils";
import { unwatchFile, watchFile, Stats } from "fs-extra";

const SERVERLESS_FOLDER = ".serverless";
const BUILD_FOLDER = ".build";

class TypeScriptPlugin {
  private originalServicePath: string;
  private isWatching = false;
  private tsconfigFilePath?: string;
  private noCopyDeps: boolean;

  serverless: ServerlessTSInstance;
  options: ServerlessTSOptions;
  hooks: { [key: string]: Function };

  constructor(serverless: ServerlessTSInstance, options: ServerlessTSOptions) {
    this.serverless = serverless;
    this.options = options;
    // if none is provided, we use try to find a valid tsconfig.json in utils.getTypescriptConfig
    // if none can be found, we return a default configuration
    this.tsconfigFilePath = options.tsconfigFilePath || serverless.service.custom?.typeScript?.tsconfigFilePath;
    this.originalServicePath = this.serverless.config.servicePath;

    this.noCopyDeps = options.noCopyDeps === "true" || serverless.service.custom?.typeScript?.noCopyDeps || false;

    this.hooks = {
      "before:run:run": async (): Promise<void> => {
        this.compileTs();
        await this.copyExtras();
        await this.copyDependencies();
      },
      "before:offline:start": async (): Promise<void> => {
        this.compileTs();
        await this.copyExtras();
        await this.copyDependencies();
        this.watchAll();
      },
      "before:offline:start:init": async (): Promise<void> => {
        this.compileTs();
        await this.copyExtras();
        await this.copyDependencies();
        this.watchAll();
      },
      "before:package:createDeploymentArtifacts": async (): Promise<void> => {
        this.compileTs();
        await this.copyExtras();
        await this.copyDependencies(true);
      },
      "after:package:createDeploymentArtifacts": async (): Promise<void> => {
        await this.cleanup();
      },
      "before:deploy:function:packageFunction": async (): Promise<void> => {
        this.compileTs();
        await this.copyExtras();
        await this.copyDependencies(true);
      },
      "after:deploy:function:packageFunction": async (): Promise<void> => {
        await this.cleanup();
      },
      "before:invoke:local:invoke": async (): Promise<void> => {
        const emitedFiles = this.compileTs();
        await this.copyExtras();
        await this.copyDependencies();
        if (this.isWatching) {
          emitedFiles?.forEach((filename) => {
            const module = require.resolve(path.resolve(this.originalServicePath, filename));
            delete require.cache[module];
          });
        }
      },
      "after:invoke:local:invoke": (): void => {
        if (this.options.watch) {
          this.watchFunction();
          this.serverless.cli.log("Waiting for changes...");
        }
      },
    };
  }

  get functions(): { [key: string]: ServerlessTSFunction } {
    const { options } = this;
    const { service } = this.serverless;

    const allFunctions = options.function
      ? {
          [options.function]: service.functions[options.function],
        }
      : service.functions;

    // Ensure we only handle runtimes that support Typescript
    return _.pickBy(allFunctions, ({ runtime }) => {
      const resolvedRuntime = runtime || service.provider.runtime;
      // If runtime is not specified on the function or provider, default to previous behaviour
      const regexRuntime = /^node/;
      return resolvedRuntime === undefined ? true : regexRuntime.exec(resolvedRuntime);
    });
  }

  get rootFileNames(): string[] {
    return extractFileNames(this.originalServicePath, this.serverless.service.provider.name, this.functions);
  }

  prepare(): void {
    // exclude serverless-plugin-typescript
    for (const fnName in this.functions) {
      const fn = this.functions[fnName];
      fn.package = fn.package || {
        exclude: [],
        include: [],
      };
      // Add plugin to excluded packages or an empty array if exclude is undefined
      fn.package.exclude = _.uniq([...(fn.package.exclude || []), "node_modules/serverless-plugin-typescript"]);
    }
  }

  watchFunction(): void {
    if (this.isWatching) {
      return;
    }

    this.serverless.cli.log(`Watch function ${this.options.function}...`);

    this.isWatching = true;
    this.watchFiles(this.rootFileNames, this.originalServicePath, async () => {
      await this.serverless.pluginManager.spawn("invoke:local");
    });
  }

  watchAll(): void {
    if (this.isWatching) {
      return;
    }

    this.serverless.cli.log("Watching typescript files...");

    this.isWatching = true;
    this.watchFiles(this.rootFileNames, this.originalServicePath, this.compileTs.bind(this));
  }

  compileTs(): string[] | undefined {
    this.prepare();
    this.serverless.cli.log("Compiling with Typescript...");

    // Fake service path so that serverless will know what to zip
    this.serverless.config.servicePath = path.join(this.originalServicePath, BUILD_FOLDER);

    const tsconfig = getTypescriptConfig(
      this.originalServicePath,
      this.tsconfigFilePath,
      this.isWatching ? undefined : this.serverless.cli,
    );

    tsconfig.outDir = BUILD_FOLDER;

    const emitedFiles = run(this.rootFileNames, tsconfig);
    this.serverless.cli.log("Typescript compiled.");
    if (!emitedFiles) {
      this.serverless.cli.log("Warning: no emitted files from TypeScript compilation.");
    }
    return emitedFiles;
  }

  /**
   * Link or copy extras such as node_modules or package.include definitions.
   */
  async copyExtras(): Promise<void> {
    const { service } = this.serverless;
    // include any "extras" from the "include" section
    await Promise.all(
      Object.values(service.functions).map((fn) => {
        return this.copyIncludes(fn.package.include);
      }),
    );
    this.copyIncludes(service.package.include);
  }

  private async copyIncludes(include: string[]): Promise<void> {
    if (!include) return;

    const files = await globby(include);
    for (const filename of files) {
      const destFileName = path.resolve(path.join(BUILD_FOLDER, filename));
      const dirname = path.dirname(destFileName);

      if (!fse.existsSync(dirname)) {
        fse.mkdirpSync(dirname);
      }

      if (!fse.existsSync(destFileName)) {
        fse.copySync(path.resolve(filename), path.resolve(path.join(BUILD_FOLDER, filename)));
      }
    }
  }

  /**
   * Copy the `node_modules` folder and `package.json` files to the output directory.
   *
   * @param isPackaging Provided if serverless is packaging the service for deployment
   */
  async copyDependencies(isPackaging = false): Promise<void> {
    if (this.noCopyDeps) {
      this.serverless.cli.log("Not copying root dependencies for this build.");
      return;
    }

    const outPkgPath = path.resolve(path.join(BUILD_FOLDER, "package.json"));
    const outModulesPath = path.resolve(path.join(BUILD_FOLDER, "node_modules"));

    // copy development dependencies during packaging
    if (isPackaging) {
      if (fse.existsSync(outModulesPath)) {
        fse.removeSync(outModulesPath);
      }

      fse.copySync(path.resolve("node_modules"), path.resolve(path.join(BUILD_FOLDER, "node_modules")), {
        dereference: true,
      });
    } else {
      if (!fse.existsSync(outModulesPath)) {
        await this.linkOrCopy(path.resolve("node_modules"), outModulesPath, "junction");
      }
    }

    // copy/link package.json
    if (!fse.existsSync(outPkgPath)) {
      await this.linkOrCopy(path.resolve("package.json"), outPkgPath, "file");
    }
  }

  /**
   * Move built code to the serverless folder, taking into account individual
   * packaging preferences.
   */
  async moveArtifacts(): Promise<void> {
    const { service } = this.serverless;

    await fse.copy(
      path.join(this.originalServicePath, BUILD_FOLDER, SERVERLESS_FOLDER),
      path.join(this.originalServicePath, SERVERLESS_FOLDER),
    );

    if (this.options.function) {
      const fn = service.functions[this.options.function];
      const artifact = fn.package.artifact;
      if (artifact) {
        fn.package.artifact = path.join(this.originalServicePath, SERVERLESS_FOLDER, path.basename(artifact));
      }
      return;
    }

    if (service.package.individually) {
      const functionNames = Object.keys(this.functions);
      functionNames.forEach((name) => {
        const artifact = service.functions[name].package.artifact;
        if (artifact) {
          service.functions[name].package.artifact = path.join(
            this.originalServicePath,
            SERVERLESS_FOLDER,
            path.basename(artifact),
          );
        }
      });
      return;
    }

    if (service.package.artifact) {
      service.package.artifact = path.join(
        this.originalServicePath,
        SERVERLESS_FOLDER,
        path.basename(service.package.artifact),
      );
    }
  }

  async cleanup(): Promise<void> {
    await this.moveArtifacts();
    // Restore service path
    this.serverless.config.servicePath = this.originalServicePath;
    // Remove temp build folder
    fse.removeSync(path.join(this.originalServicePath, BUILD_FOLDER));
  }

  /**
   * Attempt to symlink a given path or directory and copy if it fails with an
   * `EPERM` error.
   */
  private async linkOrCopy(srcPath: string, dstPath: string, type?: fse.FsSymlinkType): Promise<void> {
    return fse.symlink(srcPath, dstPath, type).catch((error) => {
      if (error.code === "EPERM" && error.errno === -4048) {
        return fse.copy(srcPath, dstPath);
      }
      throw error;
    });
  }

  private watchFiles(rootFileNames: string[], originalServicePath: string, cb: Function): void {
    const tsConfig = getTypescriptConfig(originalServicePath, this.tsconfigFilePath);
    let watchedFiles = getSourceFiles(rootFileNames, tsConfig);

    const watchCallback = (curr: Stats, prev: Stats): void => {
      // Check timestamp
      if (+curr.mtime <= +prev.mtime) {
        return;
      }

      cb();

      // use can reference not watched yet file or remove reference to already watched
      const newWatchFiles = getSourceFiles(rootFileNames, tsConfig);
      watchedFiles.forEach((fileName) => {
        if (!newWatchFiles.includes(fileName)) {
          unwatchFile(fileName, watchCallback);
        }
      });

      newWatchFiles.forEach((fileName) => {
        if (!watchedFiles.includes(fileName)) {
          watchFile(fileName, { persistent: true, interval: 250 }, watchCallback);
        }
      });

      watchedFiles = newWatchFiles;
    };

    watchedFiles.forEach((fileName) => {
      watchFile(fileName, { persistent: true, interval: 250 }, watchCallback);
    });
  }
}

export = TypeScriptPlugin;
