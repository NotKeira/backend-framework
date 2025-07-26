/**
 * Core type definitions
 */

export interface ILogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

export interface IService {
  readonly name: string;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  isReady(): boolean;
}

export interface IMiddleware {
  readonly name: string;
  readonly priority: number;
  execute(context: unknown, next: () => Promise<void>): Promise<void>;
}

export interface IEventEmitter {
  on(event: string, listener: (...args: unknown[]) => void): void;
  off(event: string, listener: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
}

export type AsyncFunction<T = unknown> = (...args: unknown[]) => Promise<T>;
export type SyncFunction<T = unknown> = (...args: unknown[]) => T;
