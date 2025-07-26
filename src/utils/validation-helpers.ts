/**
 * Validation utility functions
 */

export class ValidationHelpers {
  /**
   * Check if a value is a valid email address
   */
  public static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check if a string is a valid URL
   */
  public static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a string meets password requirements
   */
  public static isValidPassword(
    password: string,
    options: PasswordOptions = {}
  ): boolean {
    const {
      minLength = 8,
      requireUppercase = true,
      requireLowercase = true,
      requireNumbers = true,
      requireSpecialChars = true,
    } = options;

    if (password.length < minLength) return false;
    if (requireUppercase && !/[A-Z]/.test(password)) return false;
    if (requireLowercase && !/[a-z]/.test(password)) return false;
    if (requireNumbers && !/\d/.test(password)) return false;
    if (requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password))
      return false;

    return true;
  }

  /**
   * Sanitise a string by removing dangerous characters
   */
  public static sanitiseString(input: string): string {
    return input
      .replace(/[<>]/g, "") // Remove potential HTML tags
      .replace(/['"]/g, "") // Remove quotes
      .trim();
  }

  /**
   * Check if an object has all required properties
   */
  public static hasRequiredProperties<T extends Record<string, unknown>>(
    obj: T,
    requiredProps: (keyof T)[]
  ): boolean {
    return requiredProps.every(
      (prop) =>
        obj.hasOwnProperty(prop) &&
        obj[prop] !== undefined &&
        obj[prop] !== null
    );
  }

  /**
   * Deep validation of nested objects
   */
  public static validateNested<T>(
    obj: unknown,
    schema: ValidationSchema<T>
  ): ValidationResult<T> {
    const errors: string[] = [];

    if (typeof obj !== "object" || obj === null) {
      return {
        isValid: false,
        errors: ["Value must be an object"],
        data: undefined,
      };
    }

    const data = obj as Record<string, unknown>;
    const result = {} as T;

    for (const [key, validator] of Object.entries(schema)) {
      const value = data[key];
      const rule = validator as ValidationRule;

      if (rule.required && (value === undefined || value === null)) {
        errors.push(`${key} is required`);
        continue;
      }
      if (value !== undefined && rule.validate && !rule.validate(value)) {
        errors.push(rule.errorMessage || `${key} is invalid`);
        continue;
      }

      (result as Record<string, unknown>)[key] = value;
    }

    return {
      isValid: errors.length === 0,
      errors,
      data: errors.length === 0 ? result : undefined,
    };
  }
}

export interface PasswordOptions {
  minLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
}

export interface ValidationRule {
  required?: boolean;
  validate?: (value: unknown) => boolean;
  errorMessage?: string;
}

export type ValidationSchema<T> = {
  [K in keyof T]: ValidationRule;
};

export interface ValidationResult<T> {
  isValid: boolean;
  errors: string[];
  data?: T;
}
