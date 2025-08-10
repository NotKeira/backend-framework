import { RouteManager } from "./route-manager";
import { HttpRequest, HttpResponse } from "./http-server";
import { OAuthProviders } from "../auth/oauth-providers";
import { version } from "../../../package.json";

/**
 * API routes module for handling OAuth authentication routes
 */
export class ApiRoutesModule {
  private readonly routeManager: RouteManager;
  private readonly oauthProviders: OAuthProviders;
  private readonly pendingStates: Map<
    string,
    { provider: string; timestamp: number }
  > = new Map();

  constructor(routeManager: RouteManager, oauthProviders: OAuthProviders) {
    this.routeManager = routeManager;
    this.oauthProviders = oauthProviders;
    this.cleanupExpiredStates();
  }

  public registerRoutes(): void {
    this.registerOAuthRoutes();
    this.registerHealthRoutes();
  }

  private registerOAuthRoutes(): void {
    const authGroup = this.routeManager.createGroup("/auth");

    // OAuth provider list endpoint
    authGroup.get(
      "/providers",
      async (_req: HttpRequest, res: HttpResponse) => {
        const providers = this.oauthProviders.getAvailableProviders();
        res.json({ providers });
      },
      {
        description: "Get available OAuth providers",
        tags: ["auth", "oauth"],
      }
    );

    // OAuth authorization endpoint
    authGroup.get(
      "/oauth/:provider",
      async (req: HttpRequest, res: HttpResponse) => {
        try {
          const provider = req.params?.provider;
          if (!provider) {
            res.status(400).json({ error: "Provider parameter is required" });
            return;
          }

          const oauthProvider = this.oauthProviders.getProvider(provider);
          if (!oauthProvider) {
            res.status(404).json({ error: "OAuth provider not found" });
            return;
          }

          const state = this.generateState();
          const authUrl = oauthProvider.getAuthorizationUrl(state);

          // Store state temporarily for CSRF protection
          this.pendingStates.set(state, {
            provider,
            timestamp: Date.now(),
          });

          // Send redirect URL as JSON response instead of redirect
          res.json({ authUrl, state });
        } catch (error) {
          console.error("OAuth authorization error:", error);
          res.status(500).json({ error: "OAuth authorization failed" });
        }
      },
      {
        description: "Initiate OAuth authorization flow",
        tags: ["auth", "oauth"],
      }
    );

    // OAuth callback endpoint
    authGroup.get(
      "/oauth/:provider/callback",
      async (req: HttpRequest, res: HttpResponse) => {
        try {
          const provider = req.params?.provider;
          const code = req.query?.code;
          const state = req.query?.state;

          if (!provider || !code || !state) {
            res.status(400).json({ error: "Missing required parameters" });
            return;
          }

          // Verify state for CSRF protection
          const storedState = this.pendingStates.get(state);
          if (!storedState || storedState.provider !== provider) {
            res.status(400).json({ error: "Invalid state parameter" });
            return;
          }

          // Check if state has expired (15 minutes)
          if (Date.now() - storedState.timestamp > 15 * 60 * 1000) {
            this.pendingStates.delete(state);
            res.status(400).json({ error: "State has expired" });
            return;
          }

          const oauthProvider = this.oauthProviders.getProvider(provider);
          if (!oauthProvider) {
            res.status(404).json({ error: "OAuth provider not found" });
            return;
          }

          // Exchange code for access token
          const tokenResponse = await oauthProvider.exchangeCodeForToken(code);

          // Get user information
          const userInfo = await oauthProvider.getUserInfo(
            tokenResponse.access_token
          );

          // Clean up used state
          this.pendingStates.delete(state);

          // Here you would typically:
          // 1. Create or update user in database
          // 2. Create a session or JWT token
          // 3. Return user data or token

          res.json({
            success: true,
            user: userInfo,
            provider: provider,
          });
        } catch (error) {
          console.error("OAuth callback error:", error);
          res.status(500).json({ error: "OAuth callback failed" });
        }
      },
      {
        description: "Handle OAuth callback",
        tags: ["auth", "oauth"],
      }
    );
  }

  private registerHealthRoutes(): void {
    // Health check endpoint
    this.routeManager.register(
      "get",
      "/health",
      async (_req: HttpRequest, res: HttpResponse) => {
        res.json({
          status: "healthy",
          timestamp: new Date().toISOString(),
          version: "1.3.1",
        });
      },
      {
        description: "Health check endpoint",
        tags: ["health"],
      }
    );

    // API info endpoint
    this.routeManager.register(
      "get",
      "/api/info",
      async (_req: HttpRequest, res: HttpResponse) => {
        res.json({
          name: "Backend API",
          version: version || "unknown",
          endpoints: this.routeManager.getAllRoutes().length,
          oauth_providers: this.oauthProviders.getAvailableProviders(),
        });
      },
      {
        description: "API information endpoint",
        tags: ["info"],
      }
    );
  }

  private generateState(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  private cleanupExpiredStates(): void {
    // Clean up expired states every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const expiredTime = 15 * 60 * 1000; // 15 minutes

      for (const [state, data] of this.pendingStates.entries()) {
        if (now - data.timestamp > expiredTime) {
          this.pendingStates.delete(state);
        }
      }
    }, 5 * 60 * 1000);
  }
}
