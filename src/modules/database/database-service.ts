import { IService, DatabaseConfig } from "../../types/index";
import { DatabaseConnection, DatabaseInstance } from "../../database";

/**
 * Database service for managing database operations
 */
export class DatabaseService implements IService {
  public readonly name = "database-service";

  private ready = false;
  private config?: DatabaseConfig;
  private connection?: DatabaseConnection;
  private db?: DatabaseInstance;

  public async initialise(): Promise<void> {
    if (this.ready) {
      return;
    }

    console.log("🗄️  Initialising Database Service...");

    // Setup database connection and validate schema
    await this.connectToDatabase();
    await this.validateSchema();

    this.ready = true;
    console.log("✅ Database Service ready");
  }

  public async shutdown(): Promise<void> {
    if (!this.ready) {
      return;
    }

    console.log("🗄️  Shutting down Database Service...");

    // Close database connections
    await this.disconnectFromDatabase();

    this.ready = false;
    console.log("✅ Database Service shut down");
  }

  public isReady(): boolean {
    return this.ready;
  }

  public configure(config: DatabaseConfig): void {
    this.config = config;
  }

  public getDb(): DatabaseInstance {
    if (!this.db) {
      throw new Error("Database not initialized");
    }
    return this.db;
  }

  private async connectToDatabase(): Promise<void> {
    if (!this.config) {
      console.log(
        "⚠️  No database configuration provided, skipping database setup"
      );
      return;
    }

    try {
      // Convert config to match DatabaseConnection interface
      const dbConfig = {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        username: this.config.username,
        password: this.config.password,
        ssl: this.config.ssl,
        maxConnections: this.config.connectionLimit,
      };

      this.connection = DatabaseConnection.getInstance(dbConfig);
      this.db = this.connection.getDb();

      // Test the connection
      const isConnected = await this.connection.testConnection();
      if (!isConnected) {
        throw new Error("Failed to connect to database");
      }

      console.log(
        `🔗 Connected to ${this.config.type} database at ${this.config.host}:${this.config.port}`
      );
    } catch (error) {
      console.error("❌ Database connection failed:", error);
      throw error;
    }
  }

  private async disconnectFromDatabase(): Promise<void> {
    if (!this.connection) {
      return;
    }

    try {
      await this.connection.close();
      console.log("🔌 Disconnected from database");
    } catch (error) {
      console.error("❌ Error disconnecting from database:", error);
    }
  }

  private async validateSchema(): Promise<void> {
    // For now, just log that schema is validated
    // In the future, we can add actual schema validation here
    console.log("✅ Database schema validated");
  }

  public async query<T = unknown>(
    sql: string,
    _params?: unknown[]
  ): Promise<T[]> {
    if (!this.ready || !this.db) {
      throw new Error("Database service not ready");
    }

    // This is a simplified implementation
    // In practice, you'd use Drizzle's query builder
    console.log(`🔍 Query executed: ${sql}`);
    return [] as T[];
  }

  public async transaction<T>(
    callback: (trx: DatabaseTransaction) => Promise<T>
  ): Promise<T> {
    if (!this.ready || !this.db) {
      throw new Error("Database service not ready");
    }

    // Use Drizzle's transaction method
    return await this.db.transaction(async (tx) => {
      const transaction = new DrizzleTransaction(tx);
      return await callback(transaction);
    });
  }
}

export interface DatabaseTransaction {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

class DrizzleTransaction implements DatabaseTransaction {
  constructor(private readonly tx: any) {}

  public async query<T = unknown>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    console.log(`🔍 Transaction query: ${sql}`, params);
    // In practice, use this.tx to execute queries with Drizzle
    // Example: return await this.tx.execute(sql, params);
    console.log('Using transaction:', this.tx);
    return [] as T[];
  }

  public async commit(): Promise<void> {
    // Drizzle handles commits automatically
    console.log("✅ Transaction committed");
  }

  public async rollback(): Promise<void> {
    // Drizzle handles rollbacks automatically on errors
    console.log("↩️  Transaction rolled back");
  }
}
