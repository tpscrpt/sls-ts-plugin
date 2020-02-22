export interface ServerlessTSInstance {
  cli: {
    log(str: string): void
  }
  config: {
    servicePath: string
  }
  service: Partial<ServerlessTSService>
  pluginManager: ServerlessTSPluginManager
}

export interface ServerlessTSService {
  provider: {
    name: string
  }
  custom: {
    typeScript: {
      tsconfigFilePath: string | undefined
    }
  }
  functions: {
    [key: string]: ServerlessTSFunction
  }
  package: ServerlessTSPackage
  getAllFunctions(): string[]
}

export interface ServerlessTSOptions {
  function?: string
  watch?: boolean
  extraServicePath?: string
}

export interface ServerlessTSFunction {
  handler: string
  package: ServerlessTSPackage
}

export interface ServerlessTSPackage {
  include: string[]
  exclude: string[]
  artifact?: string
  individually?: boolean
}

export interface ServerlessTSPluginManager {
  spawn(command: string): Promise<void>
}