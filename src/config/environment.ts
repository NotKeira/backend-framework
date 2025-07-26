import { AppConfig, DatabaseConfig, OAuthConfig, ServerConfig } from "../types";
import { ConfigProvider } from "./config-provider";

/**
 * Environment configuration parser and validator
 */
export class Environment {
  private readonly configProvider: ConfigProvider;

  constructor() {
    this.configProvider = ConfigProvider.getInstance();
  }

  public getAppConfig(): AppConfig {
    return {
      environment: this.getEnvironment(),
      server: this.getServerConfig(),
      database: this.getDatabaseConfig(),
      oauth: this.getOAuthConfig(),
      logging: this.getLoggingConfig(),
    };
  }

  private getEnvironment(): "development" | "production" | "test" {
    const env = this.configProvider.getString("NODE_ENV", "development");
    if (env === "production" || env === "test") {
      return env;
    }
    return "development";
  }

  private getServerConfig(): ServerConfig {
    return {
      port: this.configProvider.getNumber("PORT", 3000)!,
      host: this.configProvider.getString("HOST", "0.0.0.0")!,
      cors: {
        origin: this.configProvider.getString("CORS_ORIGIN", "*")!,
        credentials: this.configProvider.getBoolean("CORS_CREDENTIALS", true)!,
      },
      rateLimit: {
        windowMs: this.configProvider.getNumber(
          "RATE_LIMIT_WINDOW_MS",
          15 * 60 * 1000
        )!,
        max: this.configProvider.getNumber("RATE_LIMIT_MAX", 100)!,
      },
    };
  }

  private getDatabaseConfig(): DatabaseConfig | undefined {
    const type = this.configProvider.getString("DB_TYPE");
    if (!type) return undefined;

    return {
      type: type as DatabaseConfig["type"],
      host: this.configProvider.getString("DB_HOST", "localhost")!,
      port: this.configProvider.getNumber("DB_PORT", 5432)!,
      database: this.configProvider.getString("DB_NAME")!,
      username: this.configProvider.getString("DB_USER")!,
      password: this.configProvider.getString("DB_PASSWORD")!,
      ssl: this.configProvider.getBoolean("DB_SSL", false),
      connectionLimit: this.configProvider.getNumber("DB_CONNECTION_LIMIT", 10),
    };
  }

  private getOAuthConfig(): OAuthConfig | undefined {
    const sessionSecret = this.configProvider.getString("OAUTH_SESSION_SECRET");
    if (!sessionSecret) return undefined;

    return {
      providers: {
        github: this.getGitHubConfig(),
        google: this.getGoogleConfig(),
        discord: this.getDiscordConfig(),
      },
      redirectUri: this.configProvider.getString(
        "OAUTH_REDIRECT_URI",
        "http://localhost:3000/auth/callback"
      )!,
      sessionSecret,
    };
  }

  private getGitHubConfig() {
    const clientId = this.configProvider.getString("GITHUB_CLIENT_ID");
    const clientSecret = this.configProvider.getString("GITHUB_CLIENT_SECRET");

    if (!clientId || !clientSecret) return undefined;

    return {
      clientId,
      clientSecret,
      scope: ["user:email", "read:user"],
    };
  }

  private getGoogleConfig() {
    const clientId = this.configProvider.getString("GOOGLE_CLIENT_ID");
    const clientSecret = this.configProvider.getString("GOOGLE_CLIENT_SECRET");

    if (!clientId || !clientSecret) return undefined;

    return {
      clientId,
      clientSecret,
      scope: ["profile", "email"],
    };
  }

  private getDiscordConfig() {
    const clientId = this.configProvider.getString("DISCORD_CLIENT_ID");
    const clientSecret = this.configProvider.getString("DISCORD_CLIENT_SECRET");

    if (!clientId || !clientSecret) return undefined;

    return {
      clientId,
      clientSecret,
      scope: ["identify", "email"],
    };
  }

  private getLoggingConfig() {
    return {
      level: this.configProvider.getString("LOG_LEVEL", "info") as
        | "debug"
        | "info"
        | "warn"
        | "error",
      format: this.configProvider.getString("LOG_FORMAT", "pretty") as
        | "json"
        | "pretty",
    };
  }
}
