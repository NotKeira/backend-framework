import { DatabaseService } from "../database/database-service";
import {
  analytics,
  analyticsAggregates,
  customReports,
  applications,
  applicationForms,
  departments,
  departmentMembers,
  trainingSessions,
} from "../../database/schema";
import { eq, and, gte, lte, count, desc } from "drizzle-orm";

export interface DashboardMetrics {
  userStats: {
    totalMembers: number;
    activeMembers: number;
    newMembersToday: number;
    newMembersThisWeek: number;
    newMembersThisMonth: number;
  };
  applicationStats: {
    totalApplications: number;
    pendingApplications: number;
    approvedToday: number;
    approvalRate: number;
  };
  departmentStats: {
    totalDepartments: number;
    activeDepartments: number;
    averageMembersPerDept: number;
  };
  activityStats: {
    totalEvents: number;
    eventsToday: number;
    eventsThisWeek: number;
  };
}

export interface ActivityMetric {
  eventType: string;
  count: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ReportConfig {
  type: string;
  title: string;
  description?: string;
  schedule?: "daily" | "weekly" | "monthly";
  metrics: string[];
  filters: {
    dateRange?: {
      start: string;
      end: string;
    };
    departments?: string[];
    userRoles?: string[];
    eventTypes?: string[];
    startDate?: Date;
    endDate?: Date;
    departmentId?: string;
  };
  visualization: {
    type: "chart" | "table" | "summary";
    chartType?: "line" | "bar" | "pie" | "area";
    groupBy?: string;
    sortBy?: string;
  };
  format?: "pdf" | "csv" | "json" | "excel";
  recipients?: string[];
}

export interface AnalyticsFilter {
  startDate?: Date;
  endDate?: Date;
  serverId?: string;
  departmentId?: string;
  eventTypes?: string[];
  userIds?: string[];
}

export class AnalyticsService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Track an analytics event
   */
  async trackEvent(
    serverId: string,
    eventType: string,
    metadata: Record<string, any> = {},
    userId?: string
  ): Promise<void> {
    try {
      await this.db.getDb().insert(analytics).values({
        serverId,
        eventType,
        userId,
        eventData: metadata,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Error tracking analytics event:", error);
      // Don't throw error to avoid disrupting main functionality
    }
  }

  /**
   * Track user activity
   */
  async trackUserActivity(
    serverId: string,
    userId: string,
    activity: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.trackEvent(
      serverId,
      "user_activity",
      {
        activity,
        ...metadata,
      },
      userId
    );
  }

  /**
   * Track application submission
   */
  async trackApplicationSubmission(
    serverId: string,
    userId: string,
    applicationId: string,
    formType: string
  ): Promise<void> {
    await this.trackEvent(
      serverId,
      "application_submitted",
      {
        applicationId,
        formType,
      },
      userId
    );
  }

  /**
   * Track department activity
   */
  async trackDepartmentActivity(
    serverId: string,
    departmentId: string,
    activity: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.trackEvent(serverId, "department_activity", {
      departmentId,
      activity,
      ...metadata,
    });
  }

  /**
   * Get dashboard metrics for a server
   */
  async getDashboardMetrics(serverId: string): Promise<DashboardMetrics> {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get member stats (total members across all departments for this server)
    const [totalMembers] = await this.db
      .getDb()
      .select({ count: count() })
      .from(departmentMembers)
      .innerJoin(
        departments,
        eq(departments.id, departmentMembers.departmentId)
      )
      .where(
        and(
          eq(departments.serverId, serverId),
          eq(departmentMembers.status, "active")
        )
      );

    // New members today
    const [newMembersToday] = await this.db
      .getDb()
      .select({ count: count() })
      .from(departmentMembers)
      .innerJoin(
        departments,
        eq(departments.id, departmentMembers.departmentId)
      )
      .where(
        and(
          eq(departments.serverId, serverId),
          gte(departmentMembers.hiredAt, todayStart)
        )
      );

    // New members this week
    const [newMembersThisWeek] = await this.db
      .getDb()
      .select({ count: count() })
      .from(departmentMembers)
      .innerJoin(
        departments,
        eq(departments.id, departmentMembers.departmentId)
      )
      .where(
        and(
          eq(departments.serverId, serverId),
          gte(departmentMembers.hiredAt, weekStart)
        )
      );

    // New members this month
    const [newMembersThisMonth] = await this.db
      .getDb()
      .select({ count: count() })
      .from(departmentMembers)
      .innerJoin(
        departments,
        eq(departments.id, departmentMembers.departmentId)
      )
      .where(
        and(
          eq(departments.serverId, serverId),
          gte(departmentMembers.hiredAt, monthStart)
        )
      );

    // Application stats (using join through applicationForms)
    const [totalApplications] = await this.db
      .getDb()
      .select({ count: count() })
      .from(applications)
      .innerJoin(applicationForms, eq(applicationForms.id, applications.formId))
      .where(eq(applicationForms.serverId, serverId));

    const [pendingApplications] = await this.db
      .getDb()
      .select({ count: count() })
      .from(applications)
      .innerJoin(applicationForms, eq(applicationForms.id, applications.formId))
      .where(
        and(
          eq(applicationForms.serverId, serverId),
          eq(applications.status, "pending")
        )
      );

    const [approvedToday] = await this.db
      .getDb()
      .select({ count: count() })
      .from(applications)
      .innerJoin(applicationForms, eq(applicationForms.id, applications.formId))
      .where(
        and(
          eq(applicationForms.serverId, serverId),
          eq(applications.status, "approved"),
          gte(applications.reviewedAt, todayStart)
        )
      );

    // Department stats
    const [totalDepartments] = await this.db
      .getDb()
      .select({ count: count() })
      .from(departments)
      .where(eq(departments.serverId, serverId));

    const [activeDepartments] = await this.db
      .getDb()
      .select({ count: count() })
      .from(departments)
      .where(
        and(eq(departments.serverId, serverId), eq(departments.isActive, true))
      );

    // Activity stats from analytics events
    const [totalEvents] = await this.db
      .getDb()
      .select({ count: count() })
      .from(analytics)
      .where(eq(analytics.serverId, serverId));

    const [eventsToday] = await this.db
      .getDb()
      .select({ count: count() })
      .from(analytics)
      .where(
        and(
          eq(analytics.serverId, serverId),
          gte(analytics.timestamp, todayStart)
        )
      );

    const [eventsThisWeek] = await this.db
      .getDb()
      .select({ count: count() })
      .from(analytics)
      .where(
        and(
          eq(analytics.serverId, serverId),
          gte(analytics.timestamp, weekStart)
        )
      );

    return {
      userStats: {
        totalMembers: totalMembers?.count || 0,
        activeMembers: totalMembers?.count || 0, // Could be refined with last activity
        newMembersToday: newMembersToday?.count || 0,
        newMembersThisWeek: newMembersThisWeek?.count || 0,
        newMembersThisMonth: newMembersThisMonth?.count || 0,
      },
      applicationStats: {
        totalApplications: totalApplications?.count || 0,
        pendingApplications: pendingApplications?.count || 0,
        approvedToday: approvedToday?.count || 0,
        approvalRate:
          totalApplications?.count && totalApplications.count > 0
            ? ((totalApplications.count - (pendingApplications?.count || 0)) /
                totalApplications.count) *
              100
            : 0,
      },
      departmentStats: {
        totalDepartments: totalDepartments?.count || 0,
        activeDepartments: activeDepartments?.count || 0,
        averageMembersPerDept:
          activeDepartments?.count && activeDepartments.count > 0
            ? (totalMembers?.count || 0) / activeDepartments.count
            : 0,
      },
      activityStats: {
        totalEvents: totalEvents?.count || 0,
        eventsToday: eventsToday?.count || 0,
        eventsThisWeek: eventsThisWeek?.count || 0,
      },
    };
  }

  /**
   * Get application metrics with optional department filter
   */
  async getApplicationMetrics(
    serverId: string,
    startDate: Date,
    endDate: Date,
    departmentId?: string
  ): Promise<Record<string, any>> {
    const results = await this.db
      .getDb()
      .select({
        status: applications.status,
        count: count(),
        department: departments.name,
      })
      .from(applications)
      .innerJoin(applicationForms, eq(applicationForms.id, applications.formId))
      .innerJoin(departments, eq(departments.id, applicationForms.departmentId))
      .where(
        and(
          eq(applicationForms.serverId, serverId),
          gte(applications.submittedAt, startDate),
          lte(applications.submittedAt, endDate),
          departmentId
            ? eq(applicationForms.departmentId, departmentId)
            : undefined
        )
      )
      .groupBy(applications.status, departments.name);

    return results;
  }

  /**
   * Get training completion metrics
   */
  async getTrainingMetrics(
    serverId: string,
    startDate: Date,
    endDate: Date,
    departmentId?: string
  ): Promise<Record<string, any>> {
    const results = await this.db
      .getDb()
      .select({
        sessionTitle: trainingSessions.title,
        completions: count(),
        department: departments.name,
      })
      .from(trainingSessions)
      .innerJoin(departments, eq(departments.id, trainingSessions.departmentId))
      .where(
        and(
          eq(trainingSessions.serverId, serverId),
          gte(trainingSessions.scheduledAt, startDate),
          lte(trainingSessions.scheduledAt, endDate),
          departmentId
            ? eq(trainingSessions.departmentId, departmentId)
            : undefined
        )
      )
      .groupBy(trainingSessions.title, departments.name);

    return results;
  }

  /**
   * Get user activity metrics
   */
  async getUserActivityMetrics(
    serverId: string,
    startDate: Date,
    endDate: Date,
    eventTypes?: string[]
  ): Promise<ActivityMetric[]> {
    const query = this.db
      .getDb()
      .select({
        eventType: analytics.eventType,
        count: count(),
        timestamp: analytics.timestamp,
        metadata: analytics.eventData,
      })
      .from(analytics)
      .where(
        and(
          eq(analytics.serverId, serverId),
          gte(analytics.timestamp, startDate),
          lte(analytics.timestamp, endDate)
        )
      )
      .groupBy(analytics.eventType, analytics.timestamp)
      .orderBy(desc(analytics.timestamp));

    const activities = await query;

    return activities.map((activity) => ({
      eventType: activity.eventType,
      count: activity.count,
      timestamp: activity.timestamp,
      metadata: activity.metadata || undefined,
    }));
  }

  /**
   * Create a custom report
   */
  async createCustomReport(
    serverId: string,
    userId: string,
    config: ReportConfig
  ): Promise<string> {
    try {
      const [result] = await this.db
        .getDb()
        .insert(customReports)
        .values({
          name: config.title,
          serverId,
          description: config.description,
          config,
          createdBy: userId,
        })
        .returning({ id: customReports.id });

      if (!result) {
        throw new Error("Failed to create report");
      }

      // Generate the report data
      const reportData = await this.generateReportData(serverId, config);

      return JSON.stringify({
        id: result.id,
        name: config.title,
        data: reportData,
        generatedAt: new Date(),
      });
    } catch (error) {
      console.error("Error creating custom report:", error);
      throw new Error("Failed to create custom report");
    }
  }

  /**
   * Generate report data based on configuration
   */
  private async generateReportData(
    serverId: string,
    config: ReportConfig
  ): Promise<Record<string, any>> {
    const data: Record<string, any> = {};

    // Add metrics based on config
    if (config.metrics?.includes("dashboard")) {
      data.dashboard = await this.getDashboardMetrics(serverId);
    }

    if (config.metrics?.includes("applications")) {
      const startDate = config.filters?.startDate
        ? new Date(config.filters.startDate)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = config.filters?.endDate
        ? new Date(config.filters.endDate)
        : new Date();

      data.applications = await this.getApplicationMetrics(
        serverId,
        startDate,
        endDate,
        config.filters?.departmentId
      );
    }

    if (config.metrics?.includes("training")) {
      const startDate = config.filters?.startDate
        ? new Date(config.filters.startDate)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = config.filters?.endDate
        ? new Date(config.filters.endDate)
        : new Date();

      data.training = await this.getTrainingMetrics(
        serverId,
        startDate,
        endDate,
        config.filters?.departmentId
      );
    }

    if (config.metrics?.includes("activity")) {
      const startDate = config.filters?.startDate
        ? new Date(config.filters.startDate)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = config.filters?.endDate
        ? new Date(config.filters.endDate)
        : new Date();

      data.activity = await this.getUserActivityMetrics(
        serverId,
        startDate,
        endDate,
        config.filters?.eventTypes
      );
    }

    return data;
  }

  /**
   * Export analytics data for external analysis
   */
  async exportAnalyticsData(
    serverId: string,
    filters: AnalyticsFilter = {}
  ): Promise<Record<string, any>> {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
      eventTypes,
      userIds,
    } = filters;

    let whereConditions = [
      eq(analytics.serverId, serverId),
      gte(analytics.timestamp, startDate),
      lte(analytics.timestamp, endDate),
    ];

    if (eventTypes && eventTypes.length > 0) {
      // For multiple event types, you would need to use 'or' conditions
      // This is a simplified version
      whereConditions.push(eq(analytics.eventType, eventTypes[0]!));
    }

    if (userIds && userIds.length > 0) {
      whereConditions.push(eq(analytics.userId, userIds[0]!));
    }

    const results = await this.db
      .getDb()
      .select()
      .from(analytics)
      .where(and(...whereConditions))
      .orderBy(desc(analytics.timestamp));

    return {
      totalEvents: results.length,
      events: results,
      exportedAt: new Date(),
      filters,
    };
  }

  /**
   * Get aggregated analytics for performance
   */
  async getAggregatedAnalytics(
    serverId: string,
    metricType: string = "daily"
  ): Promise<Record<string, any>> {
    const results = await this.db
      .getDb()
      .select()
      .from(analyticsAggregates)
      .where(
        and(
          eq(analyticsAggregates.serverId, serverId),
          eq(analyticsAggregates.metricType, metricType)
        )
      )
      .orderBy(desc(analyticsAggregates.periodStart));

    return results;
  }

  /**
   * Store aggregated analytics (typically run by a background job)
   */
  async storeAggregatedAnalytics(
    serverId: string,
    metricType: string,
    dimension: string,
    periodStart: Date,
    periodEnd: Date,
    value: number,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await this.db.getDb().insert(analyticsAggregates).values({
        serverId,
        metricType,
        dimension,
        periodStart,
        periodEnd,
        value,
        metadata,
      });
    } catch (error) {
      console.error("Error storing aggregated analytics:", error);
      throw new Error("Failed to store aggregated analytics");
    }
  }

  /**
   * Get analytics summary for a department
   */
  async getDepartmentAnalytics(
    serverId: string,
    departmentId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Record<string, any>> {
    // Get member count for the department
    const [memberCount] = await this.db
      .getDb()
      .select({ count: count() })
      .from(departmentMembers)
      .where(
        and(
          eq(departmentMembers.departmentId, departmentId),
          eq(departmentMembers.status, "active")
        )
      );

    // Get department-related analytics events
    const events = await this.db
      .getDb()
      .select()
      .from(analytics)
      .where(
        and(
          eq(analytics.serverId, serverId),
          gte(analytics.timestamp, startDate),
          lte(analytics.timestamp, endDate)
        )
      );

    // Filter events related to this department
    const departmentEvents = events.filter(
      (event) => event.eventData?.departmentId === departmentId
    );

    return {
      memberCount: memberCount?.count || 0,
      totalEvents: departmentEvents.length,
      eventsByType: departmentEvents.reduce((acc, event) => {
        acc[event.eventType] = (acc[event.eventType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      period: { startDate, endDate },
    };
  }

  /**
   * Clean up old analytics data
   */
  async cleanupOldData(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000
    );

    await this.db
      .getDb()
      .delete(analytics)
      .where(lte(analytics.timestamp, cutoffDate));

    return 0; // Drizzle delete doesn't return count
  }
}
