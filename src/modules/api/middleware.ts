import { IMiddleware } from "../../types/index";

/**
 * Common API middleware implementations
 */
export class CorsMiddleware implements IMiddleware {
  public readonly name = "cors";
  public readonly priority = 100;

  constructor(private readonly options: CorsOptions = {}) {}

  public async execute(
    context: unknown,
    next: () => Promise<void>
  ): Promise<void> {
    console.log("🌐 CORS middleware executed");

    // TODO:: Implement actual CORS headers
    const req = context as any;
    if (req.response) {
      req.response.header(
        "Access-Control-Allow-Origin",
        this.options.origin || "*"
      );
      req.response.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      req.response.header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );

      if (this.options.credentials) {
        req.response.header("Access-Control-Allow-Credentials", "true");
      }
    }

    await next();
  }
}

export class RateLimitMiddleware implements IMiddleware {
  public readonly name = "rate-limit";
  public readonly priority = 90;

  private readonly requests: Map<string, RequestCount> = new Map();

  constructor(private readonly options: RateLimitOptions) {}

  public async execute(
    context: unknown,
    next: () => Promise<void>
  ): Promise<void> {
    const req = context as any;
    const clientId = this.getClientId(req);

    if (this.isRateLimited(clientId)) {
      console.log(`🚫 Rate limit exceeded for client: ${clientId}`);

      if (req.response) {
        req.response.status(429).json({
          error: "Too Many Requests",
          message: "Rate limit exceeded",
        });
        return;
      }
    }

    this.recordRequest(clientId);
    await next();
  }

  private getClientId(req: any): string {
    // TODO:: Extract from actual request object
    return req.ip || req.headers?.["x-forwarded-for"] || "unknown";
  }

  private isRateLimited(clientId: string): boolean {
    const requestCount = this.requests.get(clientId);
    if (!requestCount) {
      return false;
    }

    const now = Date.now();
    if (now - requestCount.windowStart > this.options.windowMs) {
      // Reset window
      this.requests.delete(clientId);
      return false;
    }

    return requestCount.count >= this.options.max;
  }

  private recordRequest(clientId: string): void {
    const now = Date.now();
    const existing = this.requests.get(clientId);

    if (!existing || now - existing.windowStart > this.options.windowMs) {
      this.requests.set(clientId, { count: 1, windowStart: now });
    } else {
      existing.count++;
    }
  }
}

export class LoggingMiddleware implements IMiddleware {
  public readonly name = "logging";
  public readonly priority = 80;

  public async execute(
    context: unknown,
    next: () => Promise<void>
  ): Promise<void> {
    const req = context as any;
    const start = Date.now();

    console.log(`📝 ${req.method} ${req.url} - Started`);

    try {
      await next();
      const duration = Date.now() - start;
      console.log(`📝 ${req.method} ${req.url} - Completed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - start;
      console.log(
        `❌ ${req.method} ${req.url} - Failed in ${duration}ms:`,
        error
      );
      throw error;
    }
  }
}

export class ValidationMiddleware implements IMiddleware {
  public readonly name = "validation";
  public readonly priority = 70;

  constructor(private readonly schema?: ValidationSchema) {}

  public async execute(
    context: unknown,
    next: () => Promise<void>
  ): Promise<void> {
    const req = context as any;

    if (this.schema && req.body) {
      const isValid = this.validateRequest(req.body);
      if (!isValid) {
        console.log("❌ Request validation failed");

        if (req.response) {
          req.response.status(400).json({
            error: "Bad Request",
            message: "Request validation failed",
          });
          return;
        }
      }
    }

    console.log("✅ Request validation passed");
    await next();
  }

  private validateRequest(body: unknown): boolean {
    // TODO:: Implement actual validation logic
    return typeof body === "object" && body !== null;
  }
}

export interface CorsOptions {
  origin?: string | string[];
  credentials?: boolean;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export interface RequestCount {
  count: number;
  windowStart: number;
}

export interface ValidationSchema {
  [key: string]: unknown;
}
