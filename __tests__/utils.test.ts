import * as path from "path";

import { extractFileNames, getTypescriptConfig, makeDefaultTypescriptConfig } from "../src/utils";
import { ServerlessTSFunction } from "../src/types";

const functions: { [key: string]: ServerlessTSFunction } = {
  hello: {
    handler: "__tests__/__fixtures__/hello.handler",
    package: {
      include: [],
      exclude: [],
    },
  },
  world: {
    handler: "__tests__/__fixtures__/world.handler",
    package: {
      include: [],
      exclude: [],
    },
  },
  js: {
    handler: "__tests__/__fixtures__/jsfile.create",
    package: {
      include: [],
      exclude: [],
    },
  },
};

describe("extractFileName", () => {
  it("get function filenames from serverless service for a non-google provider", () => {
    expect(extractFileNames(process.cwd(), "aws", functions)).toEqual([
      "__tests__/__fixtures__/hello.ts",
      "__tests__/__fixtures__/world.ts",
      "__tests__/__fixtures__/jsfile.js",
    ]);
  });

  it("get function filename from serverless service for a google provider", () => {
    expect(extractFileNames(path.join(process.cwd(), "example"), "google")).toEqual(["handler.ts"]);
  });
});

describe("getTypescriptConfig", () => {
  it("returns default typescript configuration if the one provided does not exist", () => {
    expect(getTypescriptConfig("/ciaone/my-folder")).toEqual(makeDefaultTypescriptConfig());
  });

  it("returns configured typescript configuration if provided", () => {
    expect(getTypescriptConfig(process.cwd(), "./__tests__/__fixtures__/custom.tsconfig.json").target).toEqual(2);
  });
});
