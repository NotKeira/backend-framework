import { migrate } from "drizzle-orm/node-postgres/migrator";
import { DatabaseConnection } from "./config";

export class DatabaseMigrator {
  private readonly db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  async runMigrations(migrationsFolder: string = "./drizzle"): Promise<void> {
    try {
      console.log("Running database migrations...");
      await migrate(this.db.getDb(), { migrationsFolder });
      console.log("Migrations completed successfully");
    } catch (error) {
      console.error("Migration failed:", error);
      throw error;
    }
  }

  async createMigration(): Promise<void> {
    console.log("To create a migration, run: npx drizzle-kit generate");
  }
}
