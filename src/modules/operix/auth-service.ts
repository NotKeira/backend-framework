import { IService } from "../../types/index";
import { DatabaseService } from "../database/database-service";
import { users, sessions, serverMembers } from "../../database/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export type UserRole = "admin" | "staff" | "member";

export interface User {
  id: string;
  discordId: string;
  username: string;
  discriminator?: string;
  avatar?: string;
  email?: string;
  globalRole: UserRole;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  lastUsed: Date;
}

export interface ServerMember {
  id: string;
  userId: string;
  serverId: string;
  role: UserRole;
  nickname?: string;
  joinedAt: Date;
  leftAt?: Date;
  isActive: boolean;
}

export interface DiscordUserData {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  email?: string;
}

/**
 * Custom authentication service for Operix
 * Handles Discord OAuth, JWT tokens, and user sessions
 */
export class OperixAuthService implements IService {
  public readonly name = "operix-auth-service";

  private ready = false;
  private databaseService!: DatabaseService;
  private readonly jwtSecret: string =
    process.env.JWT_SECRET || "default-secret";

  public async initialise(): Promise<void> {
    if (this.ready) {
      return;
    }

    console.log("🔐 Initialising Operix Auth Service...");

    // Validate JWT secret
    if (!process.env.JWT_SECRET) {
      console.warn(
        "⚠️  Using default JWT secret - set JWT_SECRET in production!"
      );
    }

    this.ready = true;
    console.log("✅ Operix Auth Service ready");
  }

  public async shutdown(): Promise<void> {
    if (!this.ready) {
      return;
    }

    console.log("🔐 Shutting down Operix Auth Service...");
    this.ready = false;
    console.log("✅ Operix Auth Service shut down");
  }

  public isReady(): boolean {
    return this.ready;
  }

  public setDatabaseService(databaseService: DatabaseService): void {
    this.databaseService = databaseService;
  }

  /**
   * Create or update user from Discord OAuth data
   */
  public async createOrUpdateUser(discordData: DiscordUserData): Promise<User> {
    const db = this.databaseService.getDb();

    // Check if user exists
    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.discordId, discordData.id))
      .limit(1);

    if (existingUsers.length > 0) {
      // Update existing user
      const [updatedUser] = await db
        .update(users)
        .set({
          username: discordData.username,
          discriminator: discordData.discriminator,
          avatar: discordData.avatar,
          email: discordData.email,
          lastLogin: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.discordId, discordData.id))
        .returning();

      return updatedUser as User;
    } else {
      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({
          discordId: discordData.id,
          username: discordData.username,
          discriminator: discordData.discriminator,
          avatar: discordData.avatar,
          email: discordData.email,
          globalRole: "member",
          isActive: true,
          lastLogin: new Date(),
        })
        .returning();

      return newUser as User;
    }
  }

  /**
   * Create a new session for a user
   */
  public async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthSession> {
    const db = this.databaseService.getDb();

    // Generate secure token
    const token = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [session] = await db
      .insert(sessions)
      .values({
        userId,
        token,
        expiresAt,
        ipAddress,
        userAgent,
      })
      .returning();

    return session as AuthSession;
  }

  /**
   * Validate a session token
   */
  public async validateSession(token: string): Promise<User | null> {
    const db = this.databaseService.getDb();

    const sessionResult = await db
      .select({
        session: sessions,
        user: users,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.token, token), eq(users.isActive, true)))
      .limit(1);

    if (sessionResult.length === 0) {
      return null;
    }

    const sessionData = sessionResult[0];
    if (!sessionData) {
      return null;
    }

    const { session, user } = sessionData;

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      await this.revokeSession(token);
      return null;
    }

    // Update last used
    await db
      .update(sessions)
      .set({ lastUsed: new Date() })
      .where(eq(sessions.token, token));

    return user as User;
  }

  /**
   * Revoke a session
   */
  public async revokeSession(token: string): Promise<void> {
    const db = this.databaseService.getDb();

    await db.delete(sessions).where(eq(sessions.token, token));
  }

  /**
   * Revoke all sessions for a user
   */
  public async revokeAllUserSessions(userId: string): Promise<void> {
    const db = this.databaseService.getDb();

    await db.delete(sessions).where(eq(sessions.userId, userId));
  }

  /**
   * Get user's server memberships
   */
  public async getUserServerMemberships(
    userId: string
  ): Promise<ServerMember[]> {
    const db = this.databaseService.getDb();

    const memberships = await db
      .select()
      .from(serverMembers)
      .where(
        and(eq(serverMembers.userId, userId), eq(serverMembers.isActive, true))
      );

    return memberships as ServerMember[];
  }

  /**
   * Check if user has permission in a server
   */
  public async hasServerPermission(
    userId: string,
    serverId: string,
    requiredRole: UserRole = "member"
  ): Promise<boolean> {
    const db = this.databaseService.getDb();

    const membership = await db
      .select()
      .from(serverMembers)
      .where(
        and(
          eq(serverMembers.userId, userId),
          eq(serverMembers.serverId, serverId),
          eq(serverMembers.isActive, true)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return false;
    }

    const member = membership[0];
    if (!member) {
      return false;
    }

    const userRole = member.role;
    const roleHierarchy = { member: 1, staff: 2, admin: 3 };

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }

  /**
   * Clean up expired sessions
   */
  public async cleanupExpiredSessions(): Promise<number> {
    const db = this.databaseService.getDb();

    const result = await db
      .delete(sessions)
      .where(eq(sessions.expiresAt, new Date()));

    // Return a default count since rowCount may not be available
    return Array.isArray(result) ? result.length : 0;
  }

  /**
   * Generate a secure random token
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Generate JWT token (for API access)
   */
  public generateJWTToken(userId: string, expiresIn: string = "7d"): string {
    // Simple JWT implementation - in production use a proper JWT library
    const header = {
      alg: "HS256",
      typ: "JWT",
    };

    const payload = {
      userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.parseExpiresIn(expiresIn),
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
      "base64url"
    );
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      "base64url"
    );

    const signature = crypto
      .createHmac("sha256", this.jwtSecret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest("base64url");

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Verify JWT token
   */
  public verifyJWTToken(token: string): { userId: string } | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        return null;
      }

      const [encodedHeader, encodedPayload, signature] = parts;

      if (!encodedHeader || !encodedPayload || !signature) {
        return null;
      }

      // Verify signature
      const expectedSignature = crypto
        .createHmac("sha256", this.jwtSecret)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest("base64url");

      if (signature !== expectedSignature) {
        return null;
      }

      const payload = JSON.parse(
        Buffer.from(encodedPayload, "base64url").toString()
      );

      // Check expiration
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      return { userId: payload.userId };
    } catch {
      return null;
    }
  }

  private parseExpiresIn(expiresIn: string): number {
    const regex = /^(\d+)([smhd])$/;
    const match = regex.exec(expiresIn);
    if (!match?.[1] || !match?.[2]) {
      return 7 * 24 * 60 * 60; // default 7 days
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value;
      case "m":
        return value * 60;
      case "h":
        return value * 60 * 60;
      case "d":
        return value * 24 * 60 * 60;
      default:
        return 7 * 24 * 60 * 60;
    }
  }
}
