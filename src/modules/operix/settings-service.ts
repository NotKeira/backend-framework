import { DatabaseService } from "../database/database-service";
import { servers, serverMembers, userSettings } from "../../database/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { ServerSettings, UserPreferences } from "../../database/schema";

export interface ServerSettingsUpdate {
  branding?: ServerSettings["branding"];
  features?: ServerSettings["features"];
  limits?: ServerSettings["limits"];
  notifications?: ServerSettings["notifications"];
}

export interface UserSettingsUpdate {
  theme?: "light" | "dark" | "auto";
  timezone?: string;
  language?: string;
  dashboardLayout?: string[];
  notifications?: UserPreferences["notifications"];
  privacy?: UserPreferences["privacy"];
}

export interface TemplateData {
  id: string;
  templateType: string;
  name: string;
  config: Record<string, any> | null;
  isDefault: boolean;
  createdAt: Date;
}

export class SettingsService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Get user settings for a specific server or global settings
   */
  async getUserSettings(
    userId: string,
    serverId?: string
  ): Promise<UserPreferences | null> {
    try {
      const [settings] = await this.db
        .getDb()
        .select({
          settings: userSettings.settings,
        })
        .from(userSettings)
        .where(
          and(
            eq(userSettings.userId, userId),
            serverId
              ? eq(userSettings.serverId, serverId)
              : isNull(userSettings.serverId)
          )
        )
        .limit(1);

      return settings?.settings || null;
    } catch (error) {
      console.error("Error getting user settings:", error);
      throw new Error("Failed to get user settings");
    }
  }

  /**
   * Update user settings
   */
  async updateUserSettings(
    userId: string,
    settingsUpdate: UserSettingsUpdate,
    serverId?: string
  ): Promise<UserPreferences> {
    try {
      // Get existing settings
      const existing = await this.getUserSettings(userId, serverId);
      const newSettings: UserPreferences = {
        ...existing,
        ...settingsUpdate,
        notifications: {
          ...existing?.notifications,
          ...settingsUpdate.notifications,
        },
        privacy: {
          ...existing?.privacy,
          ...settingsUpdate.privacy,
        },
      };

      // Upsert settings
      const [result] = await this.db
        .getDb()
        .insert(userSettings)
        .values({
          userId,
          serverId: serverId || null,
          settings: newSettings,
        })
        .onConflictDoUpdate({
          target: [userSettings.userId, userSettings.serverId],
          set: {
            settings: newSettings,
            updatedAt: new Date(),
          },
        })
        .returning({ settings: userSettings.settings });

      if (!result?.settings) {
        throw new Error("Failed to update user settings");
      }

      return result.settings;
    } catch (error) {
      console.error("Error updating user settings:", error);
      throw new Error("Failed to update user settings");
    }
  }

  /**
   * Get server settings (requires admin permissions)
   */
  async getServerSettings(
    serverId: string,
    userId: string
  ): Promise<ServerSettings | null> {
    try {
      // Check if user has permission to view server settings
      await this.checkServerAdminPermission(userId, serverId);

      const [server] = await this.db
        .getDb()
        .select({
          settings: servers.settings,
        })
        .from(servers)
        .where(eq(servers.id, serverId))
        .limit(1);

      return server?.settings || null;
    } catch (error) {
      console.error("Error getting server settings:", error);
      throw new Error("Failed to get server settings");
    }
  }

  /**
   * Update server branding settings
   */
  async updateServerBranding(
    serverId: string,
    userId: string,
    branding: ServerSettings["branding"]
  ): Promise<ServerSettings> {
    try {
      await this.checkServerAdminPermission(userId, serverId);

      // Get existing settings
      const existing = await this.getServerSettings(serverId, userId);
      const newSettings: ServerSettings = {
        ...existing,
        branding: {
          ...existing?.branding,
          ...branding,
        },
      };

      const [result] = await this.db
        .getDb()
        .update(servers)
        .set({
          settings: newSettings,
          updatedAt: new Date(),
        })
        .where(eq(servers.id, serverId))
        .returning({ settings: servers.settings });

      if (!result?.settings) {
        throw new Error("Failed to update server branding");
      }

      return result.settings;
    } catch (error) {
      console.error("Error updating server branding:", error);
      throw new Error("Failed to update server branding");
    }
  }

  /**
   * Update server features
   */
  async updateServerFeatures(
    serverId: string,
    userId: string,
    features: ServerSettings["features"]
  ): Promise<ServerSettings> {
    try {
      await this.checkServerAdminPermission(userId, serverId);

      const existing = await this.getServerSettings(serverId, userId);
      const newSettings: ServerSettings = {
        ...existing,
        features: {
          ...existing?.features,
          ...features,
        },
      };

      const [result] = await this.db
        .getDb()
        .update(servers)
        .set({
          settings: newSettings,
          updatedAt: new Date(),
        })
        .where(eq(servers.id, serverId))
        .returning({ settings: servers.settings });

      if (!result?.settings) {
        throw new Error("Failed to update server features");
      }

      return result.settings;
    } catch (error) {
      console.error("Error updating server features:", error);
      throw new Error("Failed to update server features");
    }
  }

  /**
   * Check if user has admin permissions for server
   */
  private async checkServerAdminPermission(
    userId: string,
    serverId: string
  ): Promise<void> {
    const [member] = await this.db
      .getDb()
      .select({
        role: serverMembers.role,
      })
      .from(serverMembers)
      .where(
        and(
          eq(serverMembers.userId, userId),
          eq(serverMembers.serverId, serverId),
          eq(serverMembers.isActive, true)
        )
      )
      .limit(1);

    if (!member || (member.role !== "admin" && member.role !== "staff")) {
      throw new Error("Insufficient permissions to manage server settings");
    }
  }
}
