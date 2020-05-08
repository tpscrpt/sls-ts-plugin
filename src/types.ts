export type ServerlessTSFunctionMap = Record<string, ServerlessTSFunction>;

export interface ServerlessTSInstance {
  cli: {
    log(str: string): void;
  };
  config: {
    servicePath: string;
  };
  service: Partial<ServerlessTSService>;
  pluginManager: ServerlessTSPluginManager;
}

export interface ServerlessTSService {
  provider: {
    name: string;
    runtime?: string;
  };
  custom: {
    typeScript: {
      tsconfigFilePath: string | undefined;
    };
  };
  functions: ServerlessTSFunctionMap;
  package: ServerlessTSPackage;
  getAllFunctions(): string[];
}

export interface ServerlessTSOptions {
  function?: string;
  watch?: boolean;
  extraServicePath?: string;
  tsconfigFilePath?: string;
}

export interface ServerlessTSFunction {
  handler: string;
  package: ServerlessTSPackage;
  runtime?: string;
}

export interface ServerlessTSPackage {
  include: string[];
  exclude: string[];
  artifact?: string;
  individually?: boolean;
}

export interface ServerlessTSPluginManager {
  spawn(command: string): Promise<void>;
}
