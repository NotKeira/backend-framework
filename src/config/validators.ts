import { AppConfig } from "../types";

/**
 * Configuration validation utilities
 */
export class ConfigValidators {
  public static validateAppConfig(config: AppConfig): ValidationResult {
    const errors: string[] = [];

    // Validate server config
    if (config.server.port < 1 || config.server.port > 65535) {
      errors.push("Server port must be between 1 and 65535");
    }

    if (!config.server.host) {
      errors.push("Server host is required");
    }

    // Validate database config if present
    if (config.database) {
      if (!config.database.database) {
        errors.push("Database name is required");
      }
      if (!config.database.username) {
        errors.push("Database username is required");
      }
      if (!config.database.password) {
        errors.push("Database password is required");
      }
    }

    // Validate OAuth config if present
    if (config.oauth) {
      if (!config.oauth.sessionSecret) {
        errors.push("OAuth session secret is required");
      }
      if (
        config.oauth.sessionSecret &&
        config.oauth.sessionSecret.length < 32
      ) {
        errors.push("OAuth session secret must be at least 32 characters long");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  public static validateEnvironmentVariables(): ValidationResult {
    const errors: string[] = [];
    const requiredVars = ["NODE_ENV"];

    for (const variable of requiredVars) {
      if (!process.env[variable]) {
        errors.push(`Environment variable ${variable} is required`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}
