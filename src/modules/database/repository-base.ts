import { DatabaseService } from "./database-service";

/**
 * Base repository class for data access operations
 */
export abstract class RepositoryBase<T> {
  protected readonly tableName: string;
  protected readonly databaseService: DatabaseService;

  constructor(tableName: string, databaseService: DatabaseService) {
    this.tableName = tableName;
    this.databaseService = databaseService;
  }

  public async findById(id: string | number): Promise<T | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ?`;
    const results = await this.databaseService.query<T>(sql, [id]);
    return results.length > 0 ? results[0] ?? null : null;
  }

  public async findAll(options?: FindOptions): Promise<T[]> {
    let sql = `SELECT * FROM ${this.tableName}`;
    const params: unknown[] = [];

    if (options?.where) {
      const whereClause = this.buildWhereClause(options.where);
      sql += ` WHERE ${whereClause.sql}`;
      params.push(...whereClause.params);
    }

    if (options?.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`;
    }

    if (options?.limit) {
      sql += ` LIMIT ?`;
      params.push(options.limit);
    }

    if (options?.offset) {
      sql += ` OFFSET ?`;
      params.push(options.offset);
    }

    return await this.databaseService.query<T>(sql, params);
  }

  public async create(data: Partial<T>): Promise<T> {
    const fields = Object.keys(data);
    const placeholders = fields.map(() => "?").join(", ");
    const values = Object.values(data);

    const sql = `INSERT INTO ${this.tableName} (${fields.join(
      ", "
    )}) VALUES (${placeholders})`;
    await this.databaseService.query(sql, values);

    // Future: Return the created record with generated ID
    return data as T;
  }

  public async update(
    id: string | number,
    data: Partial<T>
  ): Promise<T | null> {
    const fields = Object.keys(data);
    const setClause = fields.map((field) => `${field} = ?`).join(", ");
    const values = [...Object.values(data), id];

    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
    await this.databaseService.query(sql, values);

    return await this.findById(id);
  }

  public async delete(id: string | number): Promise<boolean> {
    const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
    await this.databaseService.query(sql, [id]);

    // Future: Return actual affected rows count
    return true;
  }

  public async count(where?: WhereCondition): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params: unknown[] = [];

    if (where) {
      const whereClause = this.buildWhereClause(where);
      sql += ` WHERE ${whereClause.sql}`;
      params.push(...whereClause.params);
    }

    const results = await this.databaseService.query<{ count: number }>(
      sql,
      params
    );
    return results[0]?.count || 0;
  }

  protected buildWhereClause(where: WhereCondition): {
    sql: string;
    params: unknown[];
  } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    for (const [field, value] of Object.entries(where)) {
      if (Array.isArray(value)) {
        const placeholders = value.map(() => "?").join(", ");
        conditions.push(`${field} IN (${placeholders})`);
        params.push(...value);
      } else {
        conditions.push(`${field} = ?`);
        params.push(value);
      }
    }

    return {
      sql: conditions.join(" AND "),
      params,
    };
  }
}

export interface FindOptions {
  where?: WhereCondition;
  orderBy?: string;
  limit?: number;
  offset?: number;
}

export interface WhereCondition {
  [field: string]: unknown;
}
