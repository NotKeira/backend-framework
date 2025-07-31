import { IService } from "../../types/index";
import { DatabaseService } from "../database/database-service";
import {
  departments,
  departmentMembers,
  serverMembers,
  users,
} from "../../database/schema";
import { eq, and, count } from "drizzle-orm";

export type DepartmentType =
  | "fire_ems"
  | "leo"
  | "dot"
  | "dispatch"
  | "civilian";
export type MemberStatus = "active" | "inactive" | "suspended" | "terminated";

export interface Department {
  id: string;
  serverId: string;
  name: string;
  description?: string;
  type: DepartmentType;
  color?: string;
  isActive: boolean;
  settings?: DepartmentSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface DepartmentSettings {
  autoRole?: string;
  ranks?: string[];
  unitPrefix?: string;
  permissions?: {
    canViewRoster?: boolean;
    canEditRoster?: boolean;
    canManageApplications?: boolean;
  };
}

export interface DepartmentMember {
  id: string;
  departmentId: string;
  serverMemberId: string;
  rank?: string;
  unit?: string;
  status: MemberStatus;
  hiredAt: Date;
  terminatedAt?: Date;
  notes?: string;
}

export interface DepartmentMemberWithDetails extends DepartmentMember {
  user: {
    id: string;
    username: string;
    avatar?: string;
  };
  serverMember: {
    nickname?: string;
    joinedAt: Date;
  };
}

export interface CreateDepartmentData {
  serverId: string;
  name: string;
  description?: string;
  type: DepartmentType;
  color?: string;
  settings?: DepartmentSettings;
}

export interface AddMemberData {
  departmentId: string;
  serverMemberId: string;
  rank?: string;
  unit?: string;
  notes?: string;
}

export interface UpdateMemberData {
  rank?: string;
  unit?: string;
  status?: MemberStatus;
  notes?: string;
}

/**
 * Service for managing department rosters
 */
export class RosterService implements IService {
  public readonly name = "roster-service";

  private ready = false;
  private databaseService!: DatabaseService;

  public async initialise(): Promise<void> {
    if (this.ready) {
      return;
    }

    console.log("👥 Initialising Roster Service...");
    this.ready = true;
    console.log("✅ Roster Service ready");
  }

  public async shutdown(): Promise<void> {
    if (!this.ready) {
      return;
    }

    console.log("👥 Shutting down Roster Service...");
    this.ready = false;
    console.log("✅ Roster Service shut down");
  }

  public isReady(): boolean {
    return this.ready;
  }

  public setDatabaseService(databaseService: DatabaseService): void {
    this.databaseService = databaseService;
  }

  /**
   * Create a new department
   */
  public async createDepartment(
    data: CreateDepartmentData
  ): Promise<Department> {
    const db = this.databaseService.getDb();

    const [department] = await db
      .insert(departments)
      .values({
        ...data,
        isActive: true,
      })
      .returning();

    return department as Department;
  }

  /**
   * Get departments for a server
   */
  public async getServerDepartments(
    serverId: string,
    activeOnly: boolean = true
  ): Promise<Department[]> {
    const db = this.databaseService.getDb();

    const conditions = [eq(departments.serverId, serverId)];
    if (activeOnly) {
      conditions.push(eq(departments.isActive, true));
    }

    const depts = await db
      .select()
      .from(departments)
      .where(and(...conditions))
      .orderBy(departments.name);

    return depts as Department[];
  }

  /**
   * Get department by ID
   */
  public async getDepartment(departmentId: string): Promise<Department | null> {
    const db = this.databaseService.getDb();

    const [department] = await db
      .select()
      .from(departments)
      .where(eq(departments.id, departmentId))
      .limit(1);

    return department ? (department as Department) : null;
  }

  /**
   * Update a department
   */
  public async updateDepartment(
    departmentId: string,
    updates: Partial<CreateDepartmentData>
  ): Promise<Department | null> {
    const db = this.databaseService.getDb();

    const [department] = await db
      .update(departments)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(departments.id, departmentId))
      .returning();

    return department ? (department as Department) : null;
  }

  /**
   * Deactivate a department
   */
  public async deactivateDepartment(departmentId: string): Promise<boolean> {
    const db = this.databaseService.getDb();

    const result = await db
      .update(departments)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(departments.id, departmentId));

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Add member to department
   */
  public async addMemberToDepartment(
    data: AddMemberData
  ): Promise<DepartmentMember> {
    const db = this.databaseService.getDb();

    // Check if member is already in department
    const existing = await db
      .select()
      .from(departmentMembers)
      .where(
        and(
          eq(departmentMembers.departmentId, data.departmentId),
          eq(departmentMembers.serverMemberId, data.serverMemberId),
          eq(departmentMembers.status, "active")
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new Error("Member is already in this department");
    }

    const [member] = await db
      .insert(departmentMembers)
      .values({
        ...data,
        status: "active",
      })
      .returning();

    return member as DepartmentMember;
  }

  /**
   * Get department members with details
   */
  public async getDepartmentMembers(
    departmentId: string,
    status?: MemberStatus
  ): Promise<DepartmentMemberWithDetails[]> {
    const db = this.databaseService.getDb();

    const conditions = [eq(departmentMembers.departmentId, departmentId)];
    if (status) {
      conditions.push(eq(departmentMembers.status, status));
    }

    const result = await db
      .select({
        member: departmentMembers,
        user: {
          id: users.id,
          username: users.username,
          avatar: users.avatar,
        },
        serverMember: {
          nickname: serverMembers.nickname,
          joinedAt: serverMembers.joinedAt,
        },
      })
      .from(departmentMembers)
      .innerJoin(
        serverMembers,
        eq(departmentMembers.serverMemberId, serverMembers.id)
      )
      .innerJoin(users, eq(serverMembers.userId, users.id))
      .where(and(...conditions))
      .orderBy(departmentMembers.hiredAt);

    return result.map((row) => ({
      ...row.member,
      user: row.user,
      serverMember: row.serverMember,
    })) as DepartmentMemberWithDetails[];
  }

  /**
   * Update department member
   */
  public async updateDepartmentMember(
    memberId: string,
    updates: UpdateMemberData
  ): Promise<DepartmentMember | null> {
    const db = this.databaseService.getDb();

    const updateData: any = { ...updates };

    // If terminating, set terminated date
    if (updates.status === "terminated" || updates.status === "suspended") {
      updateData.terminatedAt = new Date();
    }

    const [member] = await db
      .update(departmentMembers)
      .set(updateData)
      .where(eq(departmentMembers.id, memberId))
      .returning();

    return member ? (member as DepartmentMember) : null;
  }

  /**
   * Remove member from department
   */
  public async removeMemberFromDepartment(memberId: string): Promise<boolean> {
    const db = this.databaseService.getDb();

    const result = await db
      .update(departmentMembers)
      .set({
        status: "terminated",
        terminatedAt: new Date(),
      })
      .where(eq(departmentMembers.id, memberId));

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get member's department memberships
   */
  public async getMemberDepartments(
    serverMemberId: string
  ): Promise<DepartmentMemberWithDetails[]> {
    const db = this.databaseService.getDb();

    const result = await db
      .select({
        member: departmentMembers,
        department: departments,
        user: {
          id: users.id,
          username: users.username,
          avatar: users.avatar,
        },
        serverMember: {
          nickname: serverMembers.nickname,
          joinedAt: serverMembers.joinedAt,
        },
      })
      .from(departmentMembers)
      .innerJoin(
        departments,
        eq(departmentMembers.departmentId, departments.id)
      )
      .innerJoin(
        serverMembers,
        eq(departmentMembers.serverMemberId, serverMembers.id)
      )
      .innerJoin(users, eq(serverMembers.userId, users.id))
      .where(eq(departmentMembers.serverMemberId, serverMemberId))
      .orderBy(departmentMembers.hiredAt);

    return result.map((row) => ({
      ...row.member,
      user: row.user,
      serverMember: row.serverMember,
      department: row.department,
    })) as any;
  }

  /**
   * Get department statistics
   */
  public async getDepartmentStats(departmentId: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    terminated: number;
  }> {
    const db = this.databaseService.getDb();

    const stats = await db
      .select({
        status: departmentMembers.status,
        count: count(),
      })
      .from(departmentMembers)
      .where(eq(departmentMembers.departmentId, departmentId))
      .groupBy(departmentMembers.status);

    const result = {
      total: 0,
      active: 0,
      inactive: 0,
      suspended: 0,
      terminated: 0,
    };

    stats.forEach((stat) => {
      result[stat.status as keyof typeof result] = Number(stat.count);
      result.total += Number(stat.count);
    });

    return result;
  }

  /**
   * Search members across departments
   */
  public async searchMembers(
    serverId: string,
    query: string,
    departmentId?: string
  ): Promise<DepartmentMemberWithDetails[]> {
    const db = this.databaseService.getDb();

    const conditions = [
      eq(departments.serverId, serverId),
      eq(departmentMembers.status, "active"),
    ];

    if (departmentId) {
      conditions.push(eq(departmentMembers.departmentId, departmentId));
    }

    const result = await db
      .select({
        member: departmentMembers,
        department: departments,
        user: {
          id: users.id,
          username: users.username,
          avatar: users.avatar,
        },
        serverMember: {
          nickname: serverMembers.nickname,
          joinedAt: serverMembers.joinedAt,
        },
      })
      .from(departmentMembers)
      .innerJoin(
        departments,
        eq(departmentMembers.departmentId, departments.id)
      )
      .innerJoin(
        serverMembers,
        eq(departmentMembers.serverMemberId, serverMembers.id)
      )
      .innerJoin(users, eq(serverMembers.userId, users.id))
      .where(and(...conditions));

    // Filter by query (username, nickname, rank, unit)
    const filtered = result.filter((row) => {
      const searchText = query.toLowerCase();
      return (
        row.user.username.toLowerCase().includes(searchText) ||
        row.serverMember.nickname?.toLowerCase().includes(searchText) ||
        row.member.rank?.toLowerCase().includes(searchText) ||
        row.member.unit?.toLowerCase().includes(searchText)
      );
    });

    return filtered.map((row) => ({
      ...row.member,
      user: row.user,
      serverMember: row.serverMember,
      department: row.department,
    })) as any;
  }

  /**
   * Bulk update member ranks
   */
  public async bulkUpdateRanks(
    updates: Array<{ memberId: string; rank: string }>
  ): Promise<number> {
    const db = this.databaseService.getDb();

    let updateCount = 0;

    // Use transaction for bulk updates
    await db.transaction(async (tx) => {
      for (const update of updates) {
        const result = await tx
          .update(departmentMembers)
          .set({ rank: update.rank })
          .where(eq(departmentMembers.id, update.memberId));

        if ((result.rowCount ?? 0) > 0) {
          updateCount++;
        }
      }
    });

    return updateCount;
  }

  /**
   * Export department roster to CSV format
   */
  public async exportDepartmentRoster(departmentId: string): Promise<string> {
    const members = await this.getDepartmentMembers(departmentId);

    const headers = [
      "Username",
      "Nickname",
      "Rank",
      "Unit",
      "Status",
      "Hired Date",
      "Notes",
    ];
    const rows = members.map((member) => [
      member.user.username,
      member.serverMember.nickname || "",
      member.rank || "",
      member.unit || "",
      member.status,
      member.hiredAt.toISOString().split("T")[0], // YYYY-MM-DD format
      member.notes || "",
    ]);

    return [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${(cell ?? "").toString().replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
  }
}
