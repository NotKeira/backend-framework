import { Application } from "./core/index";
import { ApiModule } from "./modules/api/api-module";
import { AuthModule } from "./modules/auth/auth-module";
import { DatabaseModule } from "./modules/database/database-module";

/**
 * Main entry point for the Operix Backend
 */
async function main(): Promise<void> {
  const app = new Application();

  // Register core modules
  app.getModuleManager().register(new DatabaseModule());
  app.getModuleManager().register(new AuthModule());
  app.getModuleManager().register(new ApiModule());

  // Setup graceful shutdown
  app.setupGracefulShutdown();

  try {
    await app.initialise();

    console.log("🚀 Operix Backend is running!");
    console.log(`📋 Environment: ${app.getConfig().environment}`);
    console.log(
      `🌐 Server: ${app.getConfig().server.host}:${app.getConfig().server.port}`
    );
  } catch (error) {
    console.error("❌ Failed to start application:", error);
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  console.error("💥 Unhandled error:", error);
  process.exit(1);
});
