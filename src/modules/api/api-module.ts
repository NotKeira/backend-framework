import { IModule } from "../../types/index";
import { HttpServer } from "./http-server";
import { RouteManager } from "./route-manager";
import { ApiRoutesModule } from "./api-routes-module";
import { OAuthProviders } from "../auth/oauth-providers";
import { Environment } from "../../config/environment";

/**
 * API module for handling HTTP server and REST endpoints
 */
export class ApiModule implements IModule {
  public readonly name = "api";
  public readonly version = "1.0.0";
  public readonly dependencies: string[] = ["auth", "database"];

  private enabled = true;
  private initialised = false;
  private httpServer?: HttpServer;
  private routeManager?: RouteManager;
  private apiRoutes?: ApiRoutesModule;
  private oauthProviders?: OAuthProviders;

  public async initialise(): Promise<void> {
    if (this.initialised) {
      return;
    }

    console.log("🌐 Initialising API Module...");

    // Setup components
    await this.setupHttpServer();
    await this.setupOAuthProviders();
    await this.registerRoutes();
    await this.registerMiddleware();

    // Start the server
    await this.httpServer?.start();

    this.initialised = true;
    console.log("✅ API Module initialised");
  }

  public async shutdown(): Promise<void> {
    if (!this.initialised) {
      return;
    }

    console.log("🌐 Shutting down API Module...");

    // Stop HTTP server
    await this.stopHttpServer();

    this.initialised = false;
    console.log("✅ API Module shut down");
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public enable(): void {
    this.enabled = true;
  }

  public disable(): void {
    this.enabled = false;
  }

  private async setupHttpServer(): Promise<void> {
    const environment = new Environment();
    const config = environment.getAppConfig();

    this.httpServer = new HttpServer(config.server);
    this.routeManager = new RouteManager();

    console.log("🚀 HTTP server configured");
  }

  private async setupOAuthProviders(): Promise<void> {
    const environment = new Environment();
    const config = environment.getAppConfig();

    if (config.oauth) {
      this.oauthProviders = new OAuthProviders();
      this.oauthProviders.configure(config.oauth);
      console.log("� OAuth providers configured");
    } else {
      console.log("⚠️  No OAuth configuration found");
    }
  }

  private async registerRoutes(): Promise<void> {
    if (!this.routeManager || !this.oauthProviders) {
      console.log("⚠️  Cannot register routes - missing dependencies");
      return;
    }

    // Setup API routes with OAuth
    this.apiRoutes = new ApiRoutesModule(
      this.routeManager,
      this.oauthProviders
    );
    this.apiRoutes.registerRoutes();

    // Register routes with HTTP server
    const allRoutes = this.routeManager.getAllRoutes();
    for (const route of allRoutes) {
      this.httpServer?.registerRoute(route.method, route.path, route.handler);
    }

    console.log(`🛣️  ${allRoutes.length} API routes registered`);
  }

  private async registerMiddleware(): Promise<void> {
    // TODO:: Register middleware (CORS, auth, validation, etc.)
    console.log("🔧 API middleware registered");
  }

  private async stopHttpServer(): Promise<void> {
    await this.httpServer?.stop();
    console.log("🛑 HTTP server stopped");
  }

  // Getter methods for accessing components
  public getHttpServer(): HttpServer | undefined {
    return this.httpServer;
  }

  public getRouteManager(): RouteManager | undefined {
    return this.routeManager;
  }

  public getOAuthProviders(): OAuthProviders | undefined {
    return this.oauthProviders;
  }
}
