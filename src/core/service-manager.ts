import { IService, ILogger } from "../types/index";
import { Logger } from "../utils/index";

/**
 * Service manager for handling application services lifecycle
 */
export class ServiceManager {
  private readonly services: Map<string, IService> = new Map();
  private readonly logger: ILogger;
  private isInitialised = false;

  constructor() {
    this.logger = Logger.getInstance();
  }

  public register(service: IService): void {
    if (this.services.has(service.name)) {
      throw new Error(`Service '${service.name}' is already registered`);
    }

    this.services.set(service.name, service);
    this.logger.info(`Service '${service.name}' registered`);
  }

  public unregister(serviceName: string): void {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service '${serviceName}' not found`);
    }

    this.services.delete(serviceName);
    this.logger.info(`Service '${serviceName}' unregistered`);
  }

  public get(serviceName: string): IService | undefined {
    return this.services.get(serviceName);
  }

  public getAll(): IService[] {
    return Array.from(this.services.values());
  }

  public async initialise(): Promise<void> {
    if (this.isInitialised) {
      this.logger.warn("Service manager already initialised");
      return;
    }

    this.logger.info("Initialising services...");

    const initPromises = Array.from(this.services.values()).map(
      async (service) => {
        try {
          await service.initialise();
          this.logger.info(
            `Service '${service.name}' initialised successfully`
          );
        } catch (error) {
          this.logger.error(
            `Failed to initialise service '${service.name}':`,
            error
          );
          throw error;
        }
      }
    );

    await Promise.all(initPromises);
    this.isInitialised = true;
    this.logger.info("All services initialised");
  }

  public async shutdown(): Promise<void> {
    if (!this.isInitialised) {
      this.logger.warn("Service manager not initialised");
      return;
    }

    this.logger.info("Shutting down services...");

    const shutdownPromises = Array.from(this.services.values()).map(
      async (service) => {
        try {
          await service.shutdown();
          this.logger.info(`Service '${service.name}' shut down successfully`);
        } catch (error) {
          this.logger.error(
            `Failed to shutdown service '${service.name}':`,
            error
          );
        }
      }
    );

    await Promise.all(shutdownPromises);
    this.isInitialised = false;
    this.logger.info("All services shut down");
  }

  public isReady(): boolean {
    return (
      this.isInitialised &&
      Array.from(this.services.values()).every((service) => service.isReady())
    );
  }
}
