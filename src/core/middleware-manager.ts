import { IMiddleware, ILogger } from "../types/index";
import { Logger } from "../utils/index";

/**
 * Middleware manager for handling request/response pipeline
 */
export class MiddlewareManager {
  private readonly middlewares: IMiddleware[] = [];
  private readonly logger: ILogger;

  constructor() {
    this.logger = Logger.getInstance();
  }

  public register(middleware: IMiddleware): void {
    // Check if middleware with same name already exists
    if (this.middlewares.some((m) => m.name === middleware.name)) {
      throw new Error(`Middleware '${middleware.name}' is already registered`);
    }

    this.middlewares.push(middleware);

    // Sort by priority (higher priority first)
    this.middlewares.sort((a, b) => b.priority - a.priority);

    this.logger.info(
      `Middleware '${middleware.name}' registered with priority ${middleware.priority}`
    );
  }

  public unregister(middlewareName: string): void {
    const index = this.middlewares.findIndex((m) => m.name === middlewareName);
    if (index === -1) {
      throw new Error(`Middleware '${middlewareName}' not found`);
    }

    this.middlewares.splice(index, 1);
    this.logger.info(`Middleware '${middlewareName}' unregistered`);
  }

  public get(middlewareName: string): IMiddleware | undefined {
    return this.middlewares.find((m) => m.name === middlewareName);
  }

  public getAll(): IMiddleware[] {
    return [...this.middlewares];
  }

  public async execute(context: unknown): Promise<void> {
    let currentIndex = 0;

    const next = async (): Promise<void> => {
      if (currentIndex >= this.middlewares.length) {
        return;
      }

      const middleware = this.middlewares[currentIndex++];
      if (!middleware) {
        return;
      }

      try {
        await middleware.execute(context, next);
      } catch (error) {
        this.logger.error(`Error in middleware '${middleware.name}':`, error);
        throw error;
      }
    };

    await next();
  }

  public clear(): void {
    this.middlewares.length = 0;
    this.logger.info("All middlewares cleared");
  }
}
