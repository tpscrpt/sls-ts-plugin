declare namespace Serverless {
  interface Instance {
    cli: {
      log(str: string): void
    }
    config: {
      servicePath: string
    }
    service: Partial<Service>
    pluginManager: PluginManager
  }

  interface Service {
    provider: {
      name: string
    }
    custom: {
      typeScript: {
        tsconfigFilePath: string | undefined
      }
    }
    functions: {
      [key: string]: Serverless.Function
    }
    package: Serverless.Package
    getAllFunctions(): string[]
  }

  interface Options {
    function?: string
    watch?: boolean
    extraServicePath?: string
  }

  interface Function {
    handler: string
    package: Serverless.Package
  }

  interface Package {
    include: string[]
    exclude: string[]
    artifact?: string
    individually?: boolean
  }

  interface PluginManager {
    spawn(command: string): Promise<void>
  }
}