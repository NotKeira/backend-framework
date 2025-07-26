import { AppConfig, ILogger } from "../types/index";
import { ServiceManager } from "./service-manager";
import { ModuleManager } from "./module-manager";
import { MiddlewareManager } from "./middleware-manager";
import { Logger, EventEmitter } from "../utils/index";
import { Environment, ConfigValidators } from "../config/index";

/**
 * Main application class that orchestrates the entire system
 */
export class Application {
  private readonly serviceManager: ServiceManager;
  private readonly moduleManager: ModuleManager;
  private readonly middlewareManager: MiddlewareManager;
  private readonly eventEmitter: EventEmitter;
  private readonly logger: ILogger;
  private readonly environment: Environment;
  private config: AppConfig;
  private isRunning = false;

  constructor() {
    this.serviceManager = new ServiceManager();
    this.moduleManager = new ModuleManager();
    this.middlewareManager = new MiddlewareManager();
    this.eventEmitter = new EventEmitter();
    this.logger = Logger.getInstance();
    this.environment = new Environment();
    this.config = this.environment.getAppConfig();
  }

  public async initialise(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn("Application is already running");
      return;
    }

    try {
      this.logger.info("Starting Operix Backend Application...");

      // Validate configuration
      await this.validateConfiguration();

      // Configure logger
      this.configureLogger();

      // Emit initialisation event
      this.eventEmitter.emit("app:initialising");

      // Initialise managers in order
      await this.moduleManager.initialise();
      await this.serviceManager.initialise();

      this.isRunning = true;
      this.logger.info("Application initialised successfully");
      this.eventEmitter.emit("app:initialised");
    } catch (error) {
      this.logger.error("Failed to initialise application:", error);
      this.eventEmitter.emit("app:error", error);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn("Application is not running");
      return;
    }

    try {
      this.logger.info("Shutting down Operix Backend Application...");
      this.eventEmitter.emit("app:shutting-down");

      // Shutdown in reverse order
      await this.serviceManager.shutdown();
      await this.moduleManager.shutdown();

      this.isRunning = false;
      this.logger.info("Application shut down successfully");
      this.eventEmitter.emit("app:shutdown");
    } catch (error) {
      this.logger.error("Error during application shutdown:", error);
      this.eventEmitter.emit("app:error", error);
      throw error;
    }
  }

  public getConfig(): AppConfig {
    return { ...this.config };
  }

  public getServiceManager(): ServiceManager {
    return this.serviceManager;
  }

  public getModuleManager(): ModuleManager {
    return this.moduleManager;
  }

  public getMiddlewareManager(): MiddlewareManager {
    return this.middlewareManager;
  }

  public getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }

  public isReady(): boolean {
    return (
      this.isRunning &&
      this.serviceManager.isReady() &&
      this.moduleManager.getAll().every((module) => module.isEnabled())
    );
  }

  public async reload(): Promise<void> {
    this.logger.info("Reloading application configuration...");

    this.config = this.environment.getAppConfig();
    await this.validateConfiguration();
    this.configureLogger();

    this.logger.info("Application configuration reloaded");
    this.eventEmitter.emit("app:reloaded");
  }

  private async validateConfiguration(): Promise<void> {
    this.logger.info("Validating configuration...");

    const validation = ConfigValidators.validateAppConfig(this.config);
    if (!validation.isValid) {
      const errorMessage = `Configuration validation failed: ${validation.errors.join(
        ", "
      )}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    const envValidation = ConfigValidators.validateEnvironmentVariables();
    if (!envValidation.isValid) {
      const errorMessage = `Environment validation failed: ${envValidation.errors.join(
        ", "
      )}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    this.logger.info("Configuration validation passed");
  }

  private configureLogger(): void {
    const logger = Logger.getInstance();

    // Map string levels to enum values
    const levelMap = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    } as const;

    const logLevel = levelMap[this.config.logging.level] ?? 1;
    logger.configure(logLevel, this.config.logging.format);
  }

  // Helper method for graceful shutdown
  public setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, initiating graceful shutdown...`);
      try {
        await this.shutdown();
        process.exit(0);
      } catch (error) {
        this.logger.error("Error during graceful shutdown:", error);
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  }
}
