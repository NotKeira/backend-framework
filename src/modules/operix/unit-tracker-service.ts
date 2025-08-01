import { IService } from "../../types/index";
import { DatabaseService } from "../database/database-service";
import {
  unitStatuses,
  departmentMembers,
  departments,
  serverMembers,
  users,
} from "../../database/schema";
import { eq, and, desc } from "drizzle-orm";

export type UnitStatus =
  | "available"
  | "busy"
  | "out_of_service"
  | "on_patrol"
  | "on_scene";

export interface UnitStatusData {
  id: string;
  departmentMemberId: string;
  status: UnitStatus;
  location?: string;
  notes?: string;
  lastUpdated: Date;
  updatedBy: string;
}

export interface UnitStatusWithDetails extends UnitStatusData {
  member: {
    id: string;
    rank?: string;
    unit?: string;
  };
  user: {
    id: string;
    username: string;
    avatar?: string;
  };
  department: {
    id: string;
    name: string;
    type: string;
    color?: string;
  };
}

export interface UpdateUnitStatusData {
  status: UnitStatus;
  location?: string;
  notes?: string;
  updatedBy: string;
}

/**
 * Service for managing live unit tracking and dispatcher views
 */
export class UnitTrackerService implements IService {
  public readonly name = "unit-tracker-service";

  private ready = false;
  private databaseService!: DatabaseService;
  private statusChangeListeners: Array<
    (status: UnitStatusWithDetails) => void
  > = [];

  public async initialise(): Promise<void> {
    if (this.ready) {
      return;
    }

    console.log("📡 Initialising Unit Tracker Service...");
    this.ready = true;
    console.log("✅ Unit Tracker Service ready");
  }

  public async shutdown(): Promise<void> {
    if (!this.ready) {
      return;
    }

    console.log("📡 Shutting down Unit Tracker Service...");
    this.statusChangeListeners = [];
    this.ready = false;
    console.log("✅ Unit Tracker Service shut down");
  }

  public isReady(): boolean {
    return this.ready;
  }

  public setDatabaseService(databaseService: DatabaseService): void {
    this.databaseService = databaseService;
  }

  /**
   * Update unit status
   */
  public async updateUnitStatus(
    departmentMemberId: string,
    data: UpdateUnitStatusData
  ): Promise<UnitStatusWithDetails | null> {
    const db = this.databaseService.getDb();

    // Check if unit status exists
    const existing = await db
      .select()
      .from(unitStatuses)
      .where(eq(unitStatuses.departmentMemberId, departmentMemberId))
      .limit(1);

    let statusRecord: any;

    if (existing.length > 0) {
      // Update existing status
      const [updated] = await db
        .update(unitStatuses)
        .set({
          status: data.status,
          location: data.location,
          notes: data.notes,
          updatedBy: data.updatedBy,
          lastUpdated: new Date(),
        })
        .where(eq(unitStatuses.departmentMemberId, departmentMemberId))
        .returning();

      statusRecord = updated;
    } else {
      // Create new status
      const [created] = await db
        .insert(unitStatuses)
        .values({
          departmentMemberId,
          status: data.status,
          location: data.location,
          notes: data.notes,
          updatedBy: data.updatedBy,
        })
        .returning();

      statusRecord = created;
    }

    // Get the full status with details
    const statusWithDetails = await this.getUnitStatusWithDetails(
      statusRecord.id
    );

    if (statusWithDetails) {
      // Notify listeners of status change
      this.notifyStatusChange(statusWithDetails);
    }

    return statusWithDetails;
  }

  /**
   * Get all active units for a server
   */
  public async getServerActiveUnits(
    serverId: string
  ): Promise<UnitStatusWithDetails[]> {
    const db = this.databaseService.getDb();

    const result = await db
      .select({
        status: unitStatuses,
        member: departmentMembers,
        user: {
          id: users.id,
          username: users.username,
          avatar: users.avatar,
        },
        department: {
          id: departments.id,
          name: departments.name,
          type: departments.type,
          color: departments.color,
        },
      })
      .from(unitStatuses)
      .innerJoin(
        departmentMembers,
        eq(unitStatuses.departmentMemberId, departmentMembers.id)
      )
      .innerJoin(
        departments,
        eq(departmentMembers.departmentId, departments.id)
      )
      .innerJoin(
        serverMembers,
        eq(departmentMembers.serverMemberId, serverMembers.id)
      )
      .innerJoin(users, eq(serverMembers.userId, users.id))
      .where(
        and(
          eq(departments.serverId, serverId),
          eq(departmentMembers.status, "active")
        )
      )
      .orderBy(desc(unitStatuses.lastUpdated));

    return result.map((row) => ({
      ...row.status,
      member: row.member,
      user: row.user,
      department: row.department,
    })) as UnitStatusWithDetails[];
  }

  /**
   * Get units by department
   */
  public async getDepartmentUnits(
    departmentId: string
  ): Promise<UnitStatusWithDetails[]> {
    const db = this.databaseService.getDb();

    const result = await db
      .select({
        status: unitStatuses,
        member: departmentMembers,
        user: {
          id: users.id,
          username: users.username,
          avatar: users.avatar,
        },
        department: {
          id: departments.id,
          name: departments.name,
          type: departments.type,
          color: departments.color,
        },
      })
      .from(unitStatuses)
      .innerJoin(
        departmentMembers,
        eq(unitStatuses.departmentMemberId, departmentMembers.id)
      )
      .innerJoin(
        departments,
        eq(departmentMembers.departmentId, departments.id)
      )
      .innerJoin(
        serverMembers,
        eq(departmentMembers.serverMemberId, serverMembers.id)
      )
      .innerJoin(users, eq(serverMembers.userId, users.id))
      .where(
        and(
          eq(departmentMembers.departmentId, departmentId),
          eq(departmentMembers.status, "active")
        )
      )
      .orderBy(desc(unitStatuses.lastUpdated));

    return result.map((row) => ({
      ...row.status,
      member: row.member,
      user: row.user,
      department: row.department,
    })) as UnitStatusWithDetails[];
  }

  /**
   * Get unit status by member ID
   */
  public async getUnitStatus(
    departmentMemberId: string
  ): Promise<UnitStatusWithDetails | null> {
    const db = this.databaseService.getDb();

    const result = await db
      .select({
        status: unitStatuses,
        member: departmentMembers,
        user: {
          id: users.id,
          username: users.username,
          avatar: users.avatar,
        },
        department: {
          id: departments.id,
          name: departments.name,
          type: departments.type,
          color: departments.color,
        },
      })
      .from(unitStatuses)
      .innerJoin(
        departmentMembers,
        eq(unitStatuses.departmentMemberId, departmentMembers.id)
      )
      .innerJoin(
        departments,
        eq(departmentMembers.departmentId, departments.id)
      )
      .innerJoin(
        serverMembers,
        eq(departmentMembers.serverMemberId, serverMembers.id)
      )
      .innerJoin(users, eq(serverMembers.userId, users.id))
      .where(eq(unitStatuses.departmentMemberId, departmentMemberId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    if (!row) {
      return null;
    }

    return {
      ...row.status,
      member: row.member,
      user: row.user,
      department: row.department,
    } as UnitStatusWithDetails;
  }

  /**
   * Get units by status
   */
  public async getUnitsByStatus(
    serverId: string,
    status: UnitStatus
  ): Promise<UnitStatusWithDetails[]> {
    const db = this.databaseService.getDb();

    const result = await db
      .select({
        status: unitStatuses,
        member: departmentMembers,
        user: {
          id: users.id,
          username: users.username,
          avatar: users.avatar,
        },
        department: {
          id: departments.id,
          name: departments.name,
          type: departments.type,
          color: departments.color,
        },
      })
      .from(unitStatuses)
      .innerJoin(
        departmentMembers,
        eq(unitStatuses.departmentMemberId, departmentMembers.id)
      )
      .innerJoin(
        departments,
        eq(departmentMembers.departmentId, departments.id)
      )
      .innerJoin(
        serverMembers,
        eq(departmentMembers.serverMemberId, serverMembers.id)
      )
      .innerJoin(users, eq(serverMembers.userId, users.id))
      .where(
        and(
          eq(departments.serverId, serverId),
          eq(unitStatuses.status, status),
          eq(departmentMembers.status, "active")
        )
      )
      .orderBy(desc(unitStatuses.lastUpdated));

    return result.map((row) => ({
      ...row.status,
      member: row.member,
      user: row.user,
      department: row.department,
    })) as UnitStatusWithDetails[];
  }

  /**
   * Set unit offline/unavailable
   */
  public async setUnitOffline(
    departmentMemberId: string,
    updatedBy: string
  ): Promise<boolean> {
    const result = await this.updateUnitStatus(departmentMemberId, {
      status: "out_of_service",
      location: undefined,
      notes: "Unit went offline",
      updatedBy,
    });

    return result !== null;
  }

  /**
   * Bulk update unit statuses (for dispatcher)
   */
  public async bulkUpdateStatuses(
    updates: Array<{
      departmentMemberId: string;
      status: UnitStatus;
      location?: string;
      notes?: string;
    }>,
    updatedBy: string
  ): Promise<number> {
    let updateCount = 0;

    for (const update of updates) {
      const result = await this.updateUnitStatus(update.departmentMemberId, {
        ...update,
        updatedBy,
      });

      if (result) {
        updateCount++;
      }
    }

    return updateCount;
  }

  /**
   * Get dispatcher view data
   */
  public async getDispatcherView(serverId: string): Promise<{
    available: UnitStatusWithDetails[];
    busy: UnitStatusWithDetails[];
    onPatrol: UnitStatusWithDetails[];
    onScene: UnitStatusWithDetails[];
    outOfService: UnitStatusWithDetails[];
    totalUnits: number;
  }> {
    const allUnits = await this.getServerActiveUnits(serverId);

    const available = allUnits.filter((unit) => unit.status === "available");
    const busy = allUnits.filter((unit) => unit.status === "busy");
    const onPatrol = allUnits.filter((unit) => unit.status === "on_patrol");
    const onScene = allUnits.filter((unit) => unit.status === "on_scene");
    const outOfService = allUnits.filter(
      (unit) => unit.status === "out_of_service"
    );

    return {
      available,
      busy,
      onPatrol,
      onScene,
      outOfService,
      totalUnits: allUnits.length,
    };
  }

  /**
   * Clean up old unit statuses (units that haven't updated in X minutes)
   */
  public async cleanupStaleUnits(
    minutesThreshold: number = 30
  ): Promise<number> {
    const db = this.databaseService.getDb();
    const thresholdDate = new Date(Date.now() - minutesThreshold * 60 * 1000);

    const result = await db
      .update(unitStatuses)
      .set({
        status: "out_of_service",
        notes: "Auto-offline due to inactivity",
        lastUpdated: new Date(),
      })
      .where(
        and(
          eq(unitStatuses.lastUpdated, thresholdDate),
          eq(unitStatuses.status, "available")
        )
      );

    return result.rowCount || 0;
  }

  /**
   * Add status change listener for real-time updates
   */
  public addStatusChangeListener(
    listener: (status: UnitStatusWithDetails) => void
  ): void {
    this.statusChangeListeners.push(listener);
  }

  /**
   * Remove status change listener
   */
  public removeStatusChangeListener(
    listener: (status: UnitStatusWithDetails) => void
  ): void {
    const index = this.statusChangeListeners.indexOf(listener);
    if (index > -1) {
      this.statusChangeListeners.splice(index, 1);
    }
  }

  /**
   * Get unit status with full details
   */
  private async getUnitStatusWithDetails(
    statusId: string
  ): Promise<UnitStatusWithDetails | null> {
    const db = this.databaseService.getDb();

    const result = await db
      .select({
        status: unitStatuses,
        member: departmentMembers,
        user: {
          id: users.id,
          username: users.username,
          avatar: users.avatar,
        },
        department: {
          id: departments.id,
          name: departments.name,
          type: departments.type,
          color: departments.color,
        },
      })
      .from(unitStatuses)
      .innerJoin(
        departmentMembers,
        eq(unitStatuses.departmentMemberId, departmentMembers.id)
      )
      .innerJoin(
        departments,
        eq(departmentMembers.departmentId, departments.id)
      )
      .innerJoin(
        serverMembers,
        eq(departmentMembers.serverMemberId, serverMembers.id)
      )
      .innerJoin(users, eq(serverMembers.userId, users.id))
      .where(eq(unitStatuses.id, statusId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    if (!row) {
      return null;
    }

    return {
      ...row.status,
      member: row.member,
      user: row.user,
      department: row.department,
    } as UnitStatusWithDetails;
  }

  /**
   * Notify all listeners of status change
   */
  private notifyStatusChange(status: UnitStatusWithDetails): void {
    this.statusChangeListeners.forEach((listener) => {
      try {
        listener(status);
      } catch (error) {
        console.error("Error in status change listener:", error);
      }
    });
  }
}
