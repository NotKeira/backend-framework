import { IService } from "../../types/index";
import { DatabaseService } from "../database/database-service";
import {
  certifications,
  trainingSessions,
  trainingAttendees,
  memberCertifications,
  departmentMembers,
  users,
  departments,
} from "../../database/schema";
import { eq, and, desc, count, gte, lte } from "drizzle-orm";

export interface Certification {
  id: string;
  serverId: string;
  departmentId?: string;
  name: string;
  description?: string;
  requirements?: string[];
  validityPeriod?: number; // Days
  isRequired: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainingSession {
  id: string;
  serverId: string;
  departmentId?: string;
  certificationId?: string;
  title: string;
  description?: string;
  instructorId: string;
  scheduledAt: Date;
  duration?: number; // Minutes
  maxAttendees?: number;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainingAttendee {
  id: string;
  sessionId: string;
  attendeeId: string;
  status: "registered" | "attended" | "absent" | "completed";
  grade?: string;
  notes?: string;
  registeredAt: Date;
  attendedAt?: Date;
}

export interface MemberCertification {
  id: string;
  departmentMemberId: string;
  certificationId: string;
  awardedBy: string;
  awardedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface TrainingSessionWithDetails extends TrainingSession {
  instructor: {
    id: string;
    username: string;
    avatar?: string;
  };
  certification?: {
    id: string;
    name: string;
  };
  department?: {
    id: string;
    name: string;
  };
  attendeeCount: number;
}

export interface CreateCertificationData {
  serverId: string;
  departmentId?: string;
  name: string;
  description?: string;
  requirements?: string[];
  validityPeriod?: number;
  isRequired?: boolean;
}

export interface CreateTrainingSessionData {
  serverId: string;
  departmentId?: string;
  certificationId?: string;
  title: string;
  description?: string;
  instructorId: string;
  scheduledAt: Date;
  duration?: number;
  maxAttendees?: number;
  location?: string;
}

export interface AwardCertificationData {
  departmentMemberId: string;
  certificationId: string;
  awardedBy: string;
  expiresAt?: Date;
}

/**
 * Service for managing training sessions and certifications
 */
export class TrainingService implements IService {
  public readonly name = "training-service";

  private ready = false;
  private databaseService!: DatabaseService;

  public async initialise(): Promise<void> {
    if (this.ready) {
      return;
    }

    console.log("🎓 Initialising Training Service...");
    this.ready = true;
    console.log("✅ Training Service ready");
  }

  public async shutdown(): Promise<void> {
    if (!this.ready) {
      return;
    }

    console.log("🎓 Shutting down Training Service...");
    this.ready = false;
    console.log("✅ Training Service shut down");
  }

  public isReady(): boolean {
    return this.ready;
  }

  public setDatabaseService(databaseService: DatabaseService): void {
    this.databaseService = databaseService;
  }

  // Certification Management
  public async createCertification(
    data: CreateCertificationData
  ): Promise<Certification> {
    const db = this.databaseService.getDb();

    const [certification] = await db
      .insert(certifications)
      .values({
        ...data,
        isRequired: data.isRequired ?? false,
      })
      .returning();

    return certification as Certification;
  }

  public async getCertifications(
    serverId: string,
    departmentId?: string
  ): Promise<Certification[]> {
    const db = this.databaseService.getDb();

    const conditions = [eq(certifications.serverId, serverId)];
    if (departmentId) {
      conditions.push(eq(certifications.departmentId, departmentId));
    }

    const certs = await db
      .select()
      .from(certifications)
      .where(and(...conditions))
      .orderBy(certifications.name);

    return certs as Certification[];
  }

  public async updateCertification(
    certificationId: string,
    updates: Partial<CreateCertificationData>
  ): Promise<Certification | null> {
    const db = this.databaseService.getDb();

    const [certification] = await db
      .update(certifications)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(certifications.id, certificationId))
      .returning();

    return certification ? (certification as Certification) : null;
  }

  // Training Session Management
  public async createTrainingSession(
    data: CreateTrainingSessionData
  ): Promise<TrainingSession> {
    const db = this.databaseService.getDb();

    const [session] = await db
      .insert(trainingSessions)
      .values(data)
      .returning();

    return session as TrainingSession;
  }

  public async getTrainingSessions(
    serverId: string,
    departmentId?: string,
    upcoming?: boolean
  ): Promise<TrainingSessionWithDetails[]> {
    const db = this.databaseService.getDb();

    const conditions = [eq(trainingSessions.serverId, serverId)];
    if (departmentId) {
      conditions.push(eq(trainingSessions.departmentId, departmentId));
    }
    if (upcoming) {
      conditions.push(gte(trainingSessions.scheduledAt, new Date()));
    }

    const sessions = await db
      .select({
        session: trainingSessions,
        instructor: {
          id: users.id,
          username: users.username,
          avatar: users.avatar,
        },
        certification: {
          id: certifications.id,
          name: certifications.name,
        },
        department: {
          id: departments.id,
          name: departments.name,
        },
      })
      .from(trainingSessions)
      .innerJoin(users, eq(trainingSessions.instructorId, users.id))
      .leftJoin(
        certifications,
        eq(trainingSessions.certificationId, certifications.id)
      )
      .leftJoin(departments, eq(trainingSessions.departmentId, departments.id))
      .where(and(...conditions))
      .orderBy(trainingSessions.scheduledAt);

    // Get attendee counts for each session
    const sessionIds = sessions.map((s) => s.session.id);
    const attendeeCounts = await this.getAttendeeCountsForSessions(sessionIds);

    return sessions.map((row) => ({
      ...row.session,
      instructor: row.instructor,
      certification: row.certification || undefined,
      department: row.department || undefined,
      attendeeCount: attendeeCounts[row.session.id] || 0,
    })) as TrainingSessionWithDetails[];
  }

  public async getTrainingSession(
    sessionId: string
  ): Promise<TrainingSessionWithDetails | null> {
    const sessions = await this.getTrainingSessions("", undefined, false);
    return sessions.find((s) => s.id === sessionId) || null;
  }

  public async updateTrainingSession(
    sessionId: string,
    updates: Partial<CreateTrainingSessionData>
  ): Promise<TrainingSession | null> {
    const db = this.databaseService.getDb();

    const [session] = await db
      .update(trainingSessions)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(trainingSessions.id, sessionId))
      .returning();

    return session ? (session as TrainingSession) : null;
  }

  public async deleteTrainingSession(sessionId: string): Promise<boolean> {
    const db = this.databaseService.getDb();

    const result = await db
      .delete(trainingSessions)
      .where(eq(trainingSessions.id, sessionId));

    return (result.rowCount ?? 0) > 0;
  }

  // Training Attendance Management
  public async registerForTraining(
    sessionId: string,
    attendeeId: string
  ): Promise<TrainingAttendee> {
    const db = this.databaseService.getDb();

    // Check if already registered
    const existing = await db
      .select()
      .from(trainingAttendees)
      .where(
        and(
          eq(trainingAttendees.sessionId, sessionId),
          eq(trainingAttendees.attendeeId, attendeeId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new Error("User is already registered for this training session");
    }

    // Check session capacity
    const session = await this.getTrainingSession(sessionId);
    if (session?.maxAttendees) {
      if (session.attendeeCount >= session.maxAttendees) {
        throw new Error("Training session is full");
      }
    }

    const [attendee] = await db
      .insert(trainingAttendees)
      .values({
        sessionId,
        attendeeId,
        status: "registered",
      })
      .returning();

    return attendee as TrainingAttendee;
  }

  public async markAttendance(
    sessionId: string,
    attendeeId: string,
    status: "attended" | "absent",
    grade?: string,
    notes?: string
  ): Promise<TrainingAttendee | null> {
    const db = this.databaseService.getDb();

    const updateData: any = {
      status,
      attendedAt: status === "attended" ? new Date() : undefined,
    };

    if (grade) updateData.grade = grade;
    if (notes) updateData.notes = notes;

    const [attendee] = await db
      .update(trainingAttendees)
      .set(updateData)
      .where(
        and(
          eq(trainingAttendees.sessionId, sessionId),
          eq(trainingAttendees.attendeeId, attendeeId)
        )
      )
      .returning();

    return attendee ? (attendee as TrainingAttendee) : null;
  }

  public async getSessionAttendees(sessionId: string): Promise<
    Array<
      TrainingAttendee & {
        user: { id: string; username: string; avatar?: string };
      }
    >
  > {
    const db = this.databaseService.getDb();

    const attendees = await db
      .select({
        attendee: trainingAttendees,
        user: {
          id: users.id,
          username: users.username,
          avatar: users.avatar,
        },
      })
      .from(trainingAttendees)
      .innerJoin(users, eq(trainingAttendees.attendeeId, users.id))
      .where(eq(trainingAttendees.sessionId, sessionId))
      .orderBy(trainingAttendees.registeredAt);

    return attendees.map((row) => ({
      ...row.attendee,
      user: row.user,
    })) as any;
  }

  // Certification Award Management
  public async awardCertification(
    data: AwardCertificationData
  ): Promise<MemberCertification> {
    const db = this.databaseService.getDb();

    // Check if member already has this certification
    const existing = await db
      .select()
      .from(memberCertifications)
      .where(
        and(
          eq(memberCertifications.departmentMemberId, data.departmentMemberId),
          eq(memberCertifications.certificationId, data.certificationId),
          eq(memberCertifications.isActive, true)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new Error("Member already has this certification");
    }

    const [certification] = await db
      .insert(memberCertifications)
      .values({
        ...data,
        isActive: true,
      })
      .returning();

    return certification as MemberCertification;
  }

  public async getMemberCertifications(
    departmentMemberId: string,
    activeOnly: boolean = true
  ): Promise<
    Array<
      MemberCertification & {
        certification: { id: string; name: string; validityPeriod?: number };
        awardedByUser: { id: string; username: string };
      }
    >
  > {
    const db = this.databaseService.getDb();

    const conditions = [
      eq(memberCertifications.departmentMemberId, departmentMemberId),
    ];
    if (activeOnly) {
      conditions.push(eq(memberCertifications.isActive, true));
    }

    const certs = await db
      .select({
        memberCert: memberCertifications,
        certification: {
          id: certifications.id,
          name: certifications.name,
          validityPeriod: certifications.validityPeriod,
        },
        awardedByUser: {
          id: users.id,
          username: users.username,
        },
      })
      .from(memberCertifications)
      .innerJoin(
        certifications,
        eq(memberCertifications.certificationId, certifications.id)
      )
      .innerJoin(users, eq(memberCertifications.awardedBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(memberCertifications.awardedAt));

    return certs.map((row) => ({
      ...row.memberCert,
      certification: row.certification,
      awardedByUser: row.awardedByUser,
    })) as any;
  }

  public async revokeCertification(
    memberCertificationId: string
  ): Promise<boolean> {
    const db = this.databaseService.getDb();

    const result = await db
      .update(memberCertifications)
      .set({ isActive: false })
      .where(eq(memberCertifications.id, memberCertificationId));

    return (result.rowCount ?? 0) > 0;
  }

  // Training Statistics
  public async getTrainingStats(
    serverId: string,
    departmentId?: string
  ): Promise<{
    totalSessions: number;
    upcomingSessions: number;
    totalAttendees: number;
    averageAttendance: number;
    completionRate: number;
  }> {
    const db = this.databaseService.getDb();

    const conditions = [eq(trainingSessions.serverId, serverId)];
    if (departmentId) {
      conditions.push(eq(trainingSessions.departmentId, departmentId));
    }

    // Get session counts
    const sessionStats = await db
      .select({
        total: count(),
        upcoming: count(),
      })
      .from(trainingSessions)
      .where(and(...conditions));

    const upcomingStats = await db
      .select({
        count: count(),
      })
      .from(trainingSessions)
      .where(and(...conditions, gte(trainingSessions.scheduledAt, new Date())));

    // Get attendance stats
    const attendanceStats = await db
      .select({
        total: count(),
        attended: count(),
        completed: count(),
      })
      .from(trainingAttendees)
      .innerJoin(
        trainingSessions,
        eq(trainingAttendees.sessionId, trainingSessions.id)
      )
      .where(and(...conditions));

    const attendedStats = await db
      .select({
        count: count(),
      })
      .from(trainingAttendees)
      .innerJoin(
        trainingSessions,
        eq(trainingAttendees.sessionId, trainingSessions.id)
      )
      .where(and(...conditions, eq(trainingAttendees.status, "attended")));

    const completedStats = await db
      .select({
        count: count(),
      })
      .from(trainingAttendees)
      .innerJoin(
        trainingSessions,
        eq(trainingAttendees.sessionId, trainingSessions.id)
      )
      .where(and(...conditions, eq(trainingAttendees.status, "completed")));

    const totalSessions = Number(sessionStats[0]?.total || 0);
    const upcomingSessions = Number(upcomingStats[0]?.count || 0);
    const totalAttendees = Number(attendanceStats[0]?.total || 0);
    const attendedCount = Number(attendedStats[0]?.count || 0);
    const completedCount = Number(completedStats[0]?.count || 0);

    return {
      totalSessions,
      upcomingSessions,
      totalAttendees,
      averageAttendance:
        totalAttendees > 0 ? (attendedCount / totalAttendees) * 100 : 0,
      completionRate:
        attendedCount > 0 ? (completedCount / attendedCount) * 100 : 0,
    };
  }

  private async getAttendeeCountsForSessions(
    sessionIds: string[]
  ): Promise<Record<string, number>> {
    if (sessionIds.length === 0) return {};

    const db = this.databaseService.getDb();

    // For now, get counts for all sessions - in production you'd use IN clause
    const counts = await db
      .select({
        sessionId: trainingAttendees.sessionId,
        count: count(),
      })
      .from(trainingAttendees)
      .groupBy(trainingAttendees.sessionId);

    // Filter to only requested session IDs
    const filteredCounts = counts.filter((c) =>
      sessionIds.includes(c.sessionId)
    );

    return filteredCounts.reduce((acc, { sessionId, count: attendeeCount }) => {
      acc[sessionId] = Number(attendeeCount);
      return acc;
    }, {} as Record<string, number>);
  }

  // Certification Expiry Management
  public async getExpiringCertifications(
    serverId: string,
    daysAhead: number = 30
  ): Promise<
    Array<
      MemberCertification & {
        member: { id: string; rank?: string; unit?: string };
        user: { id: string; username: string };
        certification: { id: string; name: string };
      }
    >
  > {
    const db = this.databaseService.getDb();

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysAhead);

    const expiring = await db
      .select({
        memberCert: memberCertifications,
        member: {
          id: departmentMembers.id,
          rank: departmentMembers.rank,
          unit: departmentMembers.unit,
        },
        user: {
          id: users.id,
          username: users.username,
        },
        certification: {
          id: certifications.id,
          name: certifications.name,
        },
      })
      .from(memberCertifications)
      .innerJoin(
        departmentMembers,
        eq(memberCertifications.departmentMemberId, departmentMembers.id)
      )
      .innerJoin(
        certifications,
        eq(memberCertifications.certificationId, certifications.id)
      )
      .innerJoin(users, eq(memberCertifications.awardedBy, users.id))
      .where(
        and(
          eq(memberCertifications.isActive, true),
          lte(memberCertifications.expiresAt, expiryDate)
        )
      )
      .orderBy(memberCertifications.expiresAt);

    return expiring.map((row) => ({
      ...row.memberCert,
      member: row.member,
      user: row.user,
      certification: row.certification,
    })) as any;
  }
}
