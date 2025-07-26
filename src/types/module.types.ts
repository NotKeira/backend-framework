/**
 * Module system type definitions
 */

export interface IModule {
  readonly name: string;
  readonly version: string;
  readonly dependencies: string[];
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  isEnabled(): boolean;
}

export interface IModuleManager {
  register(module: IModule): void;
  unregister(moduleName: string): void;
  get(moduleName: string): IModule | undefined;
  getAll(): IModule[];
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface ModuleConfig {
  name: string;
  enabled: boolean;
  settings: Record<string, unknown>;
}

export interface ModuleDependency {
  name: string;
  version: string;
  required: boolean;
}
