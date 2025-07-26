import { ILogger } from "../types/index";

/**
 * Logger implementation with multiple levels and formatting options
 */
export class Logger implements ILogger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  private format: "json" | "pretty" = "pretty";

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public configure(
    level: LogLevel,
    format: "json" | "pretty" = "pretty"
  ): void {
    this.logLevel = level;
    this.format = format;
  }

  public info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  public warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  public error(message: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  public debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (level < this.logLevel) return;

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];

    if (this.format === "json") {
      const logEntry = {
        timestamp,
        level: levelName,
        message,
        data: args.length > 0 ? args : undefined,
      };
      console.log(JSON.stringify(logEntry));
    } else {
      const colorCode = this.getColorCode(level);
      const resetCode = "\x1b[0m";
      console.log(
        `${colorCode}[${timestamp}] ${levelName}:${resetCode} ${message}`,
        ...args
      );
    }
  }

  private getColorCode(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return "\x1b[36m"; // Cyan
      case LogLevel.INFO:
        return "\x1b[32m"; // Green
      case LogLevel.WARN:
        return "\x1b[33m"; // Yellow
      case LogLevel.ERROR:
        return "\x1b[31m"; // Red
      default:
        return "\x1b[0m"; // Reset
    }
  }
}

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}
