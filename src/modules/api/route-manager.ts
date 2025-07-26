import { HttpMethod, RouteHandler } from "./http-server";

/**
 * Route manager for organising and handling API endpoints
 */
export class RouteManager {
  private readonly routes: Map<string, Route> = new Map();
  private readonly routeGroups: Map<string, RouteGroup> = new Map();

  public register(
    method: HttpMethod,
    path: string,
    handler: RouteHandler,
    options?: RouteOptions
  ): void {
    const routeKey = `${method.toUpperCase()}:${path}`;

    if (this.routes.has(routeKey)) {
      throw new Error(`Route ${routeKey} is already registered`);
    }

    const route: Route = {
      method,
      path,
      handler,
      middleware: options?.middleware || [],
      description: options?.description,
      tags: options?.tags || [],
    };

    this.routes.set(routeKey, route);
    console.log(`📝 Route registered: ${routeKey}`);
  }

  public createGroup(prefix: string): RouteGroup {
    if (this.routeGroups.has(prefix)) {
      throw new Error(`Route group '${prefix}' already exists`);
    }

    const group = new RouteGroup(prefix, this);
    this.routeGroups.set(prefix, group);
    return group;
  }

  public getRoute(method: HttpMethod, path: string): Route | undefined {
    const routeKey = `${method.toUpperCase()}:${path}`;
    return this.routes.get(routeKey);
  }

  public getAllRoutes(): Route[] {
    return Array.from(this.routes.values());
  }

  public getRoutesByTag(tag: string): Route[] {
    return this.getAllRoutes().filter((route) => route.tags.includes(tag));
  }

  public generateOpenApiSpec(): OpenApiSpec {
    const paths: Record<string, Record<string, OpenApiPath>> = {};

    for (const route of this.getAllRoutes()) {
      paths[route.path] ??= {};

      paths[route.path]![route.method] = {
        summary:
          route.description || `${route.method.toUpperCase()} ${route.path}`,
        tags: route.tags,
        responses: {
          "200": {
            description: "Success",
          },
        },
      };
    }

    return {
      openapi: "3.0.0",
      info: {
        title: "Operix Backend API",
        version: "1.0.0",
      },
      paths,
    };
  }

  public clear(): void {
    this.routes.clear();
    this.routeGroups.clear();
    console.log("🧹 All routes cleared");
  }
}

export class RouteGroup {
  constructor(
    private readonly prefix: string,
    private readonly routeManager: RouteManager
  ) {}

  public register(
    method: HttpMethod,
    path: string,
    handler: RouteHandler,
    options?: RouteOptions
  ): void {
    const fullPath = `${this.prefix}${path}`;
    this.routeManager.register(method, fullPath, handler, options);
  }

  public get(
    path: string,
    handler: RouteHandler,
    options?: RouteOptions
  ): void {
    this.register("get", path, handler, options);
  }

  public post(
    path: string,
    handler: RouteHandler,
    options?: RouteOptions
  ): void {
    this.register("post", path, handler, options);
  }

  public put(
    path: string,
    handler: RouteHandler,
    options?: RouteOptions
  ): void {
    this.register("put", path, handler, options);
  }

  public delete(
    path: string,
    handler: RouteHandler,
    options?: RouteOptions
  ): void {
    this.register("delete", path, handler, options);
  }

  public patch(
    path: string,
    handler: RouteHandler,
    options?: RouteOptions
  ): void {
    this.register("patch", path, handler, options);
  }
}

export interface Route {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
  middleware: string[];
  description?: string;
  tags: string[];
}

export interface RouteOptions {
  middleware?: string[];
  description?: string;
  tags?: string[];
}

export interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, Record<string, OpenApiPath>>;
}

export interface OpenApiPath {
  summary: string;
  tags: string[];
  responses: Record<
    string,
    {
      description: string;
    }
  >;
}
