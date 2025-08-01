import { ServerConfig } from "../../types/index";
import { createServer, IncomingMessage, ServerResponse, Server } from "http";
import { URL } from "url";

/**
 * Custom HTTP server implementation for handling API requests
 */
export class HttpServer {
  private server?: Server;
  private config: ServerConfig;
  private isRunning = false;
  private readonly routes: Map<string, RouteHandler> = new Map();
  private readonly middlewares: HttpMiddleware[] = [];

  constructor(config: ServerConfig) {
    this.config = config;
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log("⚠️  HTTP server is already running");
      return;
    }

    console.log("🚀 Starting HTTP server...");

    this.server = await this.createServer();

    return new Promise((resolve, reject) => {
      this.server!.listen(this.config.port, this.config.host, () => {
        this.isRunning = true;
        console.log(
          `✅ HTTP server listening on ${this.config.host}:${this.config.port}`
        );
        resolve();
      });

      this.server!.on("error", (error) => {
        console.error("❌ HTTP server error:", error);
        reject(error);
      });
    });
  }

  public async stop(): Promise<void> {
    if (!this.isRunning || !this.server) {
      console.log("⚠️  HTTP server is not running");
      return;
    }

    console.log("🛑 Stopping HTTP server...");

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.server = undefined;
        this.isRunning = false;
        console.log("✅ HTTP server stopped");
        resolve();
      });
    });
  }

  public getStatus(): ServerStatus {
    return {
      isRunning: this.isRunning,
      host: this.config.host,
      port: this.config.port,
      uptime: this.isRunning ? Date.now() : 0,
    };
  }

  public updateConfig(config: Partial<ServerConfig>): void {
    this.config = { ...this.config, ...config };
    console.log("🔧 HTTP server configuration updated");
  }

  private async createServer(): Promise<Server> {
    console.log("🏗️  Creating custom HTTP server instance...");

    const server = createServer(
      async (req: IncomingMessage, res: ServerResponse) => {
        try {
          await this.handleRequest(req, res);
        } catch (error) {
          console.error("❌ Request handling error:", error);
          this.sendErrorResponse(res, 500, "Internal Server Error");
        }
      }
    );

    return server;
  }

  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    // Parse request
    const request = await this.parseRequest(req);
    const response = this.createResponse(res);

    // Apply CORS headers
    this.applyCORSHeaders(response);

    // Handle preflight requests
    if (request.method === "OPTIONS") {
      response.status(200).send("");
      return;
    }

    // Apply middlewares
    let middlewareIndex = 0;
    const next = async (): Promise<void> => {
      if (middlewareIndex < this.middlewares.length) {
        const middleware = this.middlewares[middlewareIndex++];
        if (middleware) {
          await middleware.handler(request, response, next);
        }
      } else {
        // Find and execute route handler
        await this.executeRoute(request, response);
      }
    };

    await next();
  }

  private async parseRequest(req: IncomingMessage): Promise<HttpRequest> {
    const url = new URL(req.url!, `http://${req.headers.host}`);

    // Parse body for POST/PUT/PATCH requests
    let body: any = undefined;
    if (["POST", "PUT", "PATCH"].includes(req.method!)) {
      body = await this.parseBody(req);
    }

    return {
      method: req.method!,
      url: req.url!,
      pathname: url.pathname,
      headers: req.headers as Record<string, string>,
      body,
      params: {},
      query: Object.fromEntries(url.searchParams.entries()),
    };
  }

  private async parseBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          const contentType = req.headers["content-type"] || "";
          if (contentType.includes("application/json")) {
            resolve(body ? JSON.parse(body) : {});
          } else {
            resolve(body);
          }
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
      req.on("error", (error) => reject(new Error(error.message)));
    });
  }

  private createResponse(res: ServerResponse): HttpResponse {
    return {
      status: (code: number) => {
        res.statusCode = code;
        return this.createResponse(res);
      },
      json: (data: unknown) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(data));
      },
      send: (data: string) => {
        res.setHeader("Content-Type", "text/plain");
        res.end(data);
      },
      header: (name: string, value: string) => {
        res.setHeader(name, value);
        return this.createResponse(res);
      },
    };
  }

  private applyCORSHeaders(response: HttpResponse): void {
    const origin = this.config.cors?.origin || "*";
    const credentials = this.config.cors?.credentials || false;

    response.header("Access-Control-Allow-Origin", origin.toString());
    response.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, PATCH, OPTIONS"
    );
    response.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    );
    if (credentials) {
      response.header("Access-Control-Allow-Credentials", "true");
    }
  }

  private async executeRoute(
    request: HttpRequest,
    response: HttpResponse
  ): Promise<void> {
    const routeKey = `${request.method}:${request.pathname}`;
    const handler = this.routes.get(routeKey);

    if (handler) {
      await handler(request, response);
    } else {
      // Try to find route with parameters
      const paramHandler = this.findParameterizedRoute(
        request.method,
        request.pathname
      );
      if (paramHandler) {
        request.params = paramHandler.params;
        await paramHandler.handler(request, response);
      } else {
        this.sendErrorResponse(response as any, 404, "Not Found");
      }
    }
  }

  private findParameterizedRoute(
    method: string,
    pathname: string
  ): { handler: RouteHandler; params: Record<string, string> } | null {
    for (const [routeKey, handler] of this.routes.entries()) {
      const [routeMethod, routePath] = routeKey.split(":");
      if (routeMethod !== method || !routePath) continue;

      const params = this.matchRoute(routePath, pathname);
      if (params) {
        return { handler, params };
      }
    }
    return null;
  }

  private matchRoute(
    pattern: string,
    pathname: string
  ): Record<string, string> | null {
    const patternParts = pattern.split("/");
    const pathParts = pathname.split("/");

    if (patternParts.length !== pathParts.length) {
      return null;
    }

    const params: Record<string, string> = {};

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];

      if (!patternPart || !pathPart) {
        return null;
      }

      if (patternPart.startsWith(":")) {
        const paramName = patternPart.slice(1);
        params[paramName] = pathPart;
      } else if (patternPart !== pathPart) {
        return null;
      }
    }

    return params;
  }

  private sendErrorResponse(
    response: any,
    status: number,
    message: string
  ): void {
    response.statusCode = status;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ error: message }));
  }

  public registerRoute(
    method: HttpMethod,
    path: string,
    handler: RouteHandler
  ): void {
    const routeKey = `${method.toUpperCase()}:${path}`;
    this.routes.set(routeKey, handler);
    console.log(`📝 Registered ${method.toUpperCase()} ${path}`);
  }

  public registerMiddleware(middleware: HttpMiddleware): void {
    this.middlewares.push(middleware);
    console.log(`🔧 Registered middleware: ${middleware.name}`);
  }
}

export interface ServerStatus {
  isRunning: boolean;
  host: string;
  port: number;
  uptime: number;
}

export type HttpMethod =
  | "get"
  | "post"
  | "put"
  | "delete"
  | "patch"
  | "head"
  | "options";

export type RouteHandler = (
  request: HttpRequest,
  response: HttpResponse
) => Promise<void> | void;

export interface HttpMiddleware {
  name: string;
  handler: (
    request: HttpRequest,
    response: HttpResponse,
    next: () => void
  ) => Promise<void> | void;
}

export interface HttpRequest {
  method: string;
  url: string;
  pathname: string;
  headers: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
}

export interface HttpResponse {
  status(code: number): HttpResponse;
  json(data: unknown): void;
  send(data: string): void;
  header(name: string, value: string): HttpResponse;
}
