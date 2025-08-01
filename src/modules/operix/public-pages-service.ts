import { DatabaseService } from "../database/database-service";
import {
  servers,
  departments,
  departmentMembers,
  users,
  serverMembers,
} from "../../database/schema";
import { eq, and, count } from "drizzle-orm";
import type { ServerSettings } from "../../database/schema";

export interface PublicServerData {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  departmentCount: number;
  branding: ServerSettings["branding"];
  features: ServerSettings["features"];
  departments: PublicDepartmentData[];
  recentActivity?: PublicActivityData[];
  customPages?: CustomPageData[];
}

export interface PublicDepartmentData {
  id: string;
  name: string;
  type: string;
  description?: string;
  memberCount: number;
  logoUrl?: string;
  isRecruiting: boolean;
}

export interface PublicActivityData {
  type: "new_member" | "promotion" | "training" | "announcement";
  message: string;
  timestamp: Date;
  departmentId?: string;
}

export interface CustomPageData {
  id: string;
  title: string;
  slug: string;
  content: string;
  isPublished: boolean;
  order: number;
  createdAt: Date;
}

export class PublicPagesService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Get public server information for landing page
   */
  async getPublicServerInfo(
    serverId: string
  ): Promise<PublicServerData | null> {
    try {
      const [serverData] = await this.db
        .getDb()
        .select({
          id: servers.id,
          name: servers.name,
          description: servers.description,
          settings: servers.settings,
        })
        .from(servers)
        .where(eq(servers.id, serverId))
        .limit(1);

      if (!serverData) return null;

      // Get member count
      const [memberCountResult] = await this.db
        .getDb()
        .select({ count: count() })
        .from(departments)
        .innerJoin(
          departmentMembers,
          eq(departments.id, departmentMembers.departmentId)
        )
        .where(eq(departments.serverId, serverId));

      // Get department count
      const [deptCountResult] = await this.db
        .getDb()
        .select({ count: count() })
        .from(departments)
        .where(eq(departments.serverId, serverId));

      // Get public departments info
      const departmentsData = await this.db
        .getDb()
        .select({
          id: departments.id,
          name: departments.name,
          type: departments.type,
          description: departments.description,
        })
        .from(departments)
        .where(
          and(
            eq(departments.serverId, serverId),
            eq(departments.isActive, true)
          )
        );

      // Get member counts for each department
      const departmentsWithCounts = await Promise.all(
        departmentsData.map(async (dept: any) => {
          const [memberCount] = await this.db
            .getDb()
            .select({ count: count() })
            .from(departmentMembers)
            .where(
              and(
                eq(departmentMembers.departmentId, dept.id),
                eq(departmentMembers.status, "active")
              )
            );

          return {
            ...dept,
            memberCount: memberCount.count,
            isRecruiting: false, // Would come from department settings
          };
        })
      );

      const settings = serverData.settings as ServerSettings;

      return {
        id: serverData.id,
        name: serverData.name,
        description: serverData.description,
        memberCount: memberCountResult.count,
        departmentCount: deptCountResult.count,
        branding: settings?.branding || {},
        features: settings?.features || {},
        departments: departmentsWithCounts,
        recentActivity: [], // Could be populated from analytics
        customPages: [], // Would come from a custom_pages table
      };
    } catch (error) {
      console.error("Error getting public server info:", error);
      throw new Error("Failed to get public server information");
    }
  }

  /**
   * Get department roster for public viewing (if enabled)
   */
  async getPublicDepartmentRoster(
    serverId: string,
    departmentId: string
  ): Promise<any[]> {
    try {
      // Check if department allows public roster viewing
      const [department] = await this.db.getDb()
        .select({ settings: departments.settings })
        .from(departments)
        .where(
          and(
            eq(departments.id, departmentId),
            eq(departments.serverId, serverId)
          )
        )
        .limit(1);

      if (!department) {
        throw new Error("Department not found");
      }

      // For public viewing, only show basic info
      const roster = await this.db.getDb()
        .select({
          id: departmentMembers.id,
          rank: departmentMembers.rank,
          unit: departmentMembers.unit,
          username: users.username,
          avatar: users.avatar,
          hiredAt: departmentMembers.hiredAt,
        })
        .from(departmentMembers)
        .innerJoin(serverMembers, eq(departmentMembers.serverMemberId, serverMembers.id))
        .innerJoin(users, eq(serverMembers.userId, users.id))
        .where(
          and(
            eq(departmentMembers.departmentId, departmentId),
            eq(departmentMembers.status, "active")
          )
        )
        .orderBy(departmentMembers.rank, departmentMembers.hiredAt);

      return roster;
    } catch (error) {
      console.error("Error getting public department roster:", error);
      throw new Error("Failed to get department roster");
    }
  }

  /**
   * Get server statistics for public display
   */
  async getPublicServerStats(
    serverId: string
  ): Promise<Record<string, number>> {
    try {
      const stats = await Promise.all([
        // Total members across all departments
        const stats = await Promise.all([
        // Total members across all departments
        this.db.getDb()
          .select({ count: count() })
          .from(departments)
          .innerJoin(departmentMembers, eq(departments.id, departmentMembers.departmentId))
          .where(and(
            eq(departments.serverId, serverId),
            eq(departmentMembers.status, 'active')
          )),
        
        // Active departments
        this.db.getDb()
          .select({ count: count() })
          .from(departments)
          .where(and(
            eq(departments.serverId, serverId),
            eq(departments.isActive, true)
          )),
        
        // This month's applications (if public)
        this.db.getDb()
          .select({ count: count() })
          .from(departments)
          .where(eq(departments.serverId, serverId)),
      ]);,
      ]);

      return {
        totalMembers: stats[0][0].count,
        activeDepartments: stats[1][0].count,
        totalDepartments: stats[2][0].count,
      };
    } catch (error) {
      console.error("Error getting public server stats:", error);
      throw new Error("Failed to get server statistics");
    }
  }

  /**
   * Check if server has public pages enabled
   */
  async isPublicPagesEnabled(serverId: string): Promise<boolean> {
    try {
      const [server] = await this.db.getDb()
        .select({ settings: servers.settings })
        .from(servers)
        .where(eq(servers.id, serverId))
        .limit(1);

      if (!server) return false;

      const settings = server.settings as ServerSettings;
      return settings?.features?.publicPages === true;
    } catch (error) {
      console.error("Error checking public pages status:", error);
      return false;
    }
  }
}
