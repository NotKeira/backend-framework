# Operix Backend

A modular, dynamic, and easily customisable TypeScript backend framework built for scalability and maintainability.

## Features

🏗️ **Modular Architecture** - Plugin-based system with dependency management  
🔧 **Configuration Management** - Environment-based configuration with validation  
🔐 **Authentication Ready** - OAuth providers (GitHub, Google, Discord)  
🗄️ **Database Abstraction** - Connection management and repository patterns  
🌐 **HTTP API Framework** - Routing, middleware, and REST endpoints  
📝 **Comprehensive Logging** - Structured logging with multiple levels  
⚡ **Event System** - Decoupled communication via event emitters  
🛡️ **Security Middleware** - CORS, rate limiting, validation built-in

## Quick Start

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Copy environment configuration**

   ```bash
   cp .env.example .env
   ```

3. **Configure your environment**
   Edit `.env` with your settings

4. **Start development server**

   ```bash
   pnpm dev
   ```

5. **Build for production**
   ```bash
   pnpm build
   pnpm start
   ```

## Project Structure

```
src/
├── core/                 # Core framework components
│   ├── application.ts    # Main application orchestrator
│   ├── service-manager.ts
│   ├── module-manager.ts
│   └── middleware-manager.ts
├── types/                # TypeScript type definitions
│   ├── core.types.ts
│   ├── module.types.ts
│   └── config.types.ts
├── config/               # Configuration management
│   ├── config-provider.ts
│   ├── environment.ts
│   └── validators.ts
├── utils/                # Utility functions
│   ├── logger.ts
│   ├── event-emitter.ts
│   ├── async-helpers.ts
│   └── validation-helpers.ts
├── modules/              # Feature modules
│   ├── auth/            # Authentication & OAuth
│   ├── database/        # Database operations
│   └── api/             # HTTP API handling
└── index.ts             # Application entry point
```

## Architecture

### Core Framework

The framework is built around several key managers:

- **Application**: Orchestrates the entire system lifecycle
- **ServiceManager**: Manages application services
- **ModuleManager**: Handles modular components with dependencies
- **MiddlewareManager**: Processes request/response pipeline

### Configuration System

Environment-based configuration with automatic validation:

```typescript
import { Environment } from "./config";

const env = new Environment();
const config = env.getAppConfig();
```

### Module System

Create custom modules by implementing the `IModule` interface:

```typescript
export class CustomModule implements IModule {
  public readonly name = "custom";
  public readonly version = "1.0.0";
  public readonly dependencies = ["auth"];

  public async initialise(): Promise<void> {
    // Module initialisation logic
  }

  public async shutdown(): Promise<void> {
    // Cleanup logic
  }

  public isEnabled(): boolean {
    return true;
  }
}
```

## Available Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build TypeScript to JavaScript
- `pnpm start` - Start production server
- `pnpm clean` - Remove build artifacts
- `pnpm type-check` - Run TypeScript type checking

## Environment Configuration

Key environment variables:

```bash
# Server
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# Database (optional)
DB_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432

# OAuth (optional)
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

See `.env.example` for all available options.

## License

Apache License 2.0
Read the full license in the [LICENSE](LICENSE) file.
