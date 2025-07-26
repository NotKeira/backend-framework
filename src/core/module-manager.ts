import { IModule, IModuleManager, ILogger } from "../types/index";
import { Logger } from "../utils/index";

/**
 * Module manager for handling modular system components
 */
export class ModuleManager implements IModuleManager {
  private readonly modules: Map<string, IModule> = new Map();
  private readonly logger: ILogger;
  private readonly dependencyGraph: Map<string, Set<string>> = new Map();
  private isInitialised = false;

  constructor() {
    this.logger = Logger.getInstance();
  }

  public register(module: IModule): void {
    if (this.modules.has(module.name)) {
      throw new Error(`Module '${module.name}' is already registered`);
    }

    this.modules.set(module.name, module);
    this.buildDependencyGraph(module);
    this.logger.info(`Module '${module.name}' registered`);
  }

  public unregister(moduleName: string): void {
    const module = this.modules.get(moduleName);
    if (!module) {
      throw new Error(`Module '${moduleName}' not found`);
    }

    // Check if other modules depend on this one
    const dependents = this.findDependents(moduleName);
    if (dependents.length > 0) {
      throw new Error(
        `Cannot unregister module '${moduleName}' - it is required by: ${dependents.join(
          ", "
        )}`
      );
    }

    this.modules.delete(moduleName);
    this.dependencyGraph.delete(moduleName);
    this.logger.info(`Module '${moduleName}' unregistered`);
  }

  public get(moduleName: string): IModule | undefined {
    return this.modules.get(moduleName);
  }

  public getAll(): IModule[] {
    return Array.from(this.modules.values());
  }

  public async initialise(): Promise<void> {
    if (this.isInitialised) {
      this.logger.warn("Module manager already initialised");
      return;
    }

    this.logger.info("Initialising modules...");

    // Validate dependencies
    this.validateDependencies();

    // Get initialisation order based on dependencies
    const initOrder = this.getInitialisationOrder();

    // Initialise modules in dependency order
    for (const moduleName of initOrder) {
      const module = this.modules.get(moduleName);
      if (module?.isEnabled()) {
        try {
          await module.initialise();
          this.logger.info(`Module '${moduleName}' initialised successfully`);
        } catch (error) {
          this.logger.error(
            `Failed to initialise module '${moduleName}':`,
            error
          );
          throw error;
        }
      }
    }

    this.isInitialised = true;
    this.logger.info("All modules initialised");
  }

  public async shutdown(): Promise<void> {
    if (!this.isInitialised) {
      this.logger.warn("Module manager not initialised");
      return;
    }

    this.logger.info("Shutting down modules...");

    // Shutdown in reverse order
    const initOrder = this.getInitialisationOrder().reverse();

    for (const moduleName of initOrder) {
      const module = this.modules.get(moduleName);
      if (module) {
        try {
          await module.shutdown();
          this.logger.info(`Module '${moduleName}' shut down successfully`);
        } catch (error) {
          this.logger.error(
            `Failed to shutdown module '${moduleName}':`,
            error
          );
        }
      }
    }

    this.isInitialised = false;
    this.logger.info("All modules shut down");
  }

  private buildDependencyGraph(module: IModule): void {
    this.dependencyGraph.set(module.name, new Set(module.dependencies));
  }

  private validateDependencies(): void {
    for (const [moduleName, dependencies] of this.dependencyGraph) {
      for (const dependency of dependencies) {
        if (!this.modules.has(dependency)) {
          throw new Error(
            `Module '${moduleName}' depends on '${dependency}' which is not registered`
          );
        }
      }
    }

    // Check for circular dependencies
    this.detectCircularDependencies();
  }

  private detectCircularDependencies(): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const visit = (moduleName: string): boolean => {
      if (recursionStack.has(moduleName)) {
        return true; // Circular dependency detected
      }
      if (visited.has(moduleName)) {
        return false;
      }

      visited.add(moduleName);
      recursionStack.add(moduleName);

      const dependencies = this.dependencyGraph.get(moduleName) || new Set();
      for (const dependency of dependencies) {
        if (visit(dependency)) {
          throw new Error(
            `Circular dependency detected involving module '${moduleName}'`
          );
        }
      }

      recursionStack.delete(moduleName);
      return false;
    };

    for (const moduleName of this.modules.keys()) {
      if (!visited.has(moduleName)) {
        visit(moduleName);
      }
    }
  }

  private getInitialisationOrder(): string[] {
    const sorted: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (moduleName: string): void => {
      if (visiting.has(moduleName)) {
        throw new Error(
          `Circular dependency detected for module '${moduleName}'`
        );
      }
      if (visited.has(moduleName)) {
        return;
      }

      visiting.add(moduleName);
      const dependencies = this.dependencyGraph.get(moduleName) || new Set();

      for (const dependency of dependencies) {
        visit(dependency);
      }

      visiting.delete(moduleName);
      visited.add(moduleName);
      sorted.push(moduleName);
    };

    for (const moduleName of this.modules.keys()) {
      if (!visited.has(moduleName)) {
        visit(moduleName);
      }
    }

    return sorted;
  }

  private findDependents(moduleName: string): string[] {
    const dependents: string[] = [];

    for (const [module, dependencies] of this.dependencyGraph) {
      if (dependencies.has(moduleName)) {
        dependents.push(module);
      }
    }

    return dependents;
  }
}
