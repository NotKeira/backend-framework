/**
 * Configuration type definitions
 */

export interface IConfigProvider {
  get<T = unknown>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  getAll(): Record<string, unknown>;
}

export interface DatabaseConfig {
  type: "postgresql" | "mysql" | "sqlite" | "mongodb";
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  connectionLimit?: number;
}

export interface OAuthConfig {
  providers: {
    github?: {
      clientId: string;
      clientSecret: string;
      scope: string[];
    };
    google?: {
      clientId: string;
      clientSecret: string;
      scope: string[];
    };
    discord?: {
      clientId: string;
      clientSecret: string;
      scope: string[];
    };
    roblox?: {
      clientId: string;
      clientSecret: string;
      scope: string[];
    };
  };
  redirectUri: string;
  sessionSecret: string;
}

export interface ServerConfig {
  port: number;
  host: string;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
}

export interface AppConfig {
  environment: "development" | "production" | "test";
  server: ServerConfig;
  database?: DatabaseConfig;
  oauth?: OAuthConfig;
  logging: {
    level: "debug" | "info" | "warn" | "error";
    format: "json" | "pretty";
  };
}
