import { IConfigProvider } from "../types";
import dotenv from "dotenv";

/**
 * Environment-based configuration provider
 */
export class ConfigProvider implements IConfigProvider {
  private config: Record<string, unknown> = {};
  private static instance: ConfigProvider;

  private constructor() {
    this.loadEnvironmentVariables();
  }

  public static getInstance(): ConfigProvider {
    if (!ConfigProvider.instance) {
      ConfigProvider.instance = new ConfigProvider();
    }
    return ConfigProvider.instance;
  }

  private loadEnvironmentVariables(): void {
    dotenv.config();

    // Load all environment variables into config
    this.config = { ...process.env };
  }

  public get<T = unknown>(key: string): T | undefined {
    const value = this.config[key];
    return value as T | undefined;
  }

  public set(key: string, value: unknown): void {
    this.config[key] = value;
  }

  public has(key: string): boolean {
    return key in this.config;
  }

  public getAll(): Record<string, unknown> {
    return { ...this.config };
  }

  public reload(): void {
    this.loadEnvironmentVariables();
  }

  public getString(key: string, defaultValue?: string): string | undefined {
    const value = this.get<string>(key);
    return value ?? defaultValue;
  }

  public getNumber(key: string, defaultValue?: number): number | undefined {
    const value = this.get<string>(key);
    if (value === undefined) return defaultValue;
    const parsed = Number(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  public getBoolean(key: string, defaultValue?: boolean): boolean | undefined {
    const value = this.get<string>(key);
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === "true";
  }
}
