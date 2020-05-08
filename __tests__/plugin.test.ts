import TypeScriptPlugin from "../src";
import { ServerlessTSInstance, ServerlessTSFunctionMap } from "../src/types";

const createInstance = (functions: ServerlessTSFunctionMap, globalRuntime?: string): ServerlessTSInstance => ({
  cli: {
    log: jest.fn(),
  },
  config: {
    servicePath: "servicePath",
  },
  service: {
    provider: {
      name: "aws",
      runtime: globalRuntime,
    },
    package: {
      individually: true,
      include: [],
      exclude: [],
    },
    functions,
    getAllFunctions: jest.fn(),
  },
  pluginManager: {
    spawn: jest.fn(),
  },
});

describe("functions", () => {
  const functions: ServerlessTSFunctionMap = {
    hello: {
      handler: "tests/assets/hello.handler",
      package: {
        include: [],
        exclude: [],
      },
    },
    world: {
      handler: "tests/assets/world.handler",
      runtime: "nodejs12.x",
      package: {
        include: [],
        exclude: [],
      },
    },
    js: {
      handler: "tests/assets/jsfile.create",
      package: {
        include: [],
        exclude: [],
      },
    },
    notActuallyTypescript: {
      handler: "tests/assets/jsfile.create",
      package: {
        include: [],
        exclude: [],
      },
      runtime: "go1.x",
    },
  };

  describe("when the provider runtime is Node", () => {
    it("can get filter out non node based functions", () => {
      const slsInstance = createInstance(functions, "nodejs10.x");
      const plugin = new TypeScriptPlugin(slsInstance, {});

      expect(Object.values(plugin.functions).map((fn) => fn.handler)).toEqual([
        "tests/assets/hello.handler",
        "tests/assets/world.handler",
        "tests/assets/jsfile.create",
      ]);
    });
  });

  describe("when the provider runtime is not Node", () => {
    it("can get filter out non node based functions", () => {
      const slsInstance = createInstance(functions, "python2.7");
      const plugin = new TypeScriptPlugin(slsInstance, {});

      expect(Object.values(plugin.functions).map((fn) => fn.handler)).toEqual(["tests/assets/world.handler"]);
    });
  });

  describe("when the provider runtime is undefined", () => {
    it("can get filter out non node based functions", () => {
      const slsInstance = createInstance(functions);
      const plugin = new TypeScriptPlugin(slsInstance, {});

      expect(Object.values(plugin.functions).map((fn) => fn.handler)).toEqual([
        "tests/assets/hello.handler",
        "tests/assets/world.handler",
        "tests/assets/jsfile.create",
      ]);
    });
  });
});
