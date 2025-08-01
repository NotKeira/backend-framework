import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  json,
  uuid,
  varchar,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "staff", "member"]);
export const applicationStatusEnum = pgEnum("application_status", [
  "pending",
  "approved",
  "denied",
  "under_review",
]);
export const applicationTypeEnum = pgEnum("application_type", [
  "staff",
  "loa",
  "ra",
  "department",
  "custom",
]);
export const departmentTypeEnum = pgEnum("department_type", [
  "fire_ems",
  "leo",
  "dot",
  "dispatch",
  "civilian",
]);
export const memberStatusEnum = pgEnum("member_status", [
  "active",
  "inactive",
  "suspended",
  "terminated",
]);
export const unitStatusEnum = pgEnum("unit_status", [
  "available",
  "busy",
  "out_of_service",
  "on_patrol",
  "on_scene",
]);
export const fileVisibilityEnum = pgEnum("file_visibility", [
  "public",
  "private",
  "server",
]);

// Core Tables
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  discordId: varchar("discord_id", { length: 20 }).unique().notNull(),
  username: varchar("username", { length: 100 }).notNull(),
  discriminator: varchar("discriminator", { length: 4 }),
  avatar: text("avatar"),
  email: varchar("email", { length: 255 }),
  globalRole: userRoleEnum("global_role").default("member").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const servers = pgTable("servers", {
  id: uuid("id").primaryKey().defaultRandom(),
  discordGuildId: varchar("discord_guild_id", { length: 20 })
    .unique()
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  logo: text("logo"),
  customUrl: varchar("custom_url", { length: 50 }).unique(),
  discordInvite: varchar("discord_invite", { length: 100 }),
  isPublic: boolean("is_public").default(false).notNull(),
  isFeatured: boolean("is_featured").default(false).notNull(),
  settings: json("settings").$type<ServerSettings>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const serverMembers = pgTable("server_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  serverId: uuid("server_id")
    .references(() => servers.id)
    .notNull(),
  role: userRoleEnum("role").default("member").notNull(),
  nickname: varchar("nickname", { length: 100 }),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  leftAt: timestamp("left_at"),
  isActive: boolean("is_active").default(true).notNull(),
});

export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id")
    .references(() => servers.id)
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  type: departmentTypeEnum("type").notNull(),
  color: varchar("color", { length: 7 }), // Hex color
  isActive: boolean("is_active").default(true).notNull(),
  settings: json("settings").$type<DepartmentSettings>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const departmentMembers = pgTable("department_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  departmentId: uuid("department_id")
    .references(() => departments.id)
    .notNull(),
  serverMemberId: uuid("server_member_id")
    .references(() => serverMembers.id)
    .notNull(),
  rank: varchar("rank", { length: 100 }),
  unit: varchar("unit", { length: 50 }),
  status: memberStatusEnum("status").default("active").notNull(),
  hiredAt: timestamp("hired_at").defaultNow().notNull(),
  terminatedAt: timestamp("terminated_at"),
  notes: text("notes"),
});

// Applications System
export const applicationForms = pgTable("application_forms", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id")
    .references(() => servers.id)
    .notNull(),
  departmentId: uuid("department_id").references(() => departments.id),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  type: applicationTypeEnum("type").notNull(),
  fields: json("fields").$type<ApplicationField[]>().notNull(),
  settings: json("settings").$type<ApplicationFormSettings>(),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  formId: uuid("form_id")
    .references(() => applicationForms.id)
    .notNull(),
  applicantId: uuid("applicant_id")
    .references(() => users.id)
    .notNull(),
  responses: json("responses").$type<Record<string, any>>().notNull(),
  status: applicationStatusEnum("status").default("pending").notNull(),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  tags: json("tags").$type<string[]>(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Training & Certification
export const certifications = pgTable("certifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id")
    .references(() => servers.id)
    .notNull(),
  departmentId: uuid("department_id").references(() => departments.id),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  requirements: json("requirements").$type<string[]>(),
  validityPeriod: integer("validity_period"), // Days
  isRequired: boolean("is_required").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const trainingSessions = pgTable("training_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id")
    .references(() => servers.id)
    .notNull(),
  departmentId: uuid("department_id").references(() => departments.id),
  certificationId: uuid("certification_id").references(() => certifications.id),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  instructorId: uuid("instructor_id")
    .references(() => users.id)
    .notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  duration: integer("duration"), // Minutes
  maxAttendees: integer("max_attendees"),
  location: varchar("location", { length: 200 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const trainingAttendees = pgTable("training_attendees", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .references(() => trainingSessions.id)
    .notNull(),
  attendeeId: uuid("attendee_id")
    .references(() => users.id)
    .notNull(),
  status: varchar("status", { length: 20 }).default("registered").notNull(), // registered, attended, absent, completed
  grade: varchar("grade", { length: 10 }), // Pass/Fail or percentage
  notes: text("notes"),
  registeredAt: timestamp("registered_at").defaultNow().notNull(),
  attendedAt: timestamp("attended_at"),
});

export const memberCertifications = pgTable("member_certifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  departmentMemberId: uuid("department_member_id")
    .references(() => departmentMembers.id)
    .notNull(),
  certificationId: uuid("certification_id")
    .references(() => certifications.id)
    .notNull(),
  awardedBy: uuid("awarded_by")
    .references(() => users.id)
    .notNull(),
  awardedAt: timestamp("awarded_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true).notNull(),
});

// Scheduling & Patrol Logging
export const patrols = pgTable("patrols", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id")
    .references(() => servers.id)
    .notNull(),
  departmentId: uuid("department_id")
    .references(() => departments.id)
    .notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  scheduledStart: timestamp("scheduled_start").notNull(),
  scheduledEnd: timestamp("scheduled_end").notNull(),
  actualStart: timestamp("actual_start"),
  actualEnd: timestamp("actual_end"),
  maxParticipants: integer("max_participants"),
  supervisorId: uuid("supervisor_id").references(() => users.id),
  status: varchar("status", { length: 20 }).default("scheduled").notNull(), // scheduled, active, completed, cancelled
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const patrolParticipants = pgTable("patrol_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  patrolId: uuid("patrol_id")
    .references(() => patrols.id)
    .notNull(),
  participantId: uuid("participant_id")
    .references(() => users.id)
    .notNull(),
  signedUpAt: timestamp("signed_up_at").defaultNow().notNull(),
  signedInAt: timestamp("signed_in_at"),
  signedOutAt: timestamp("signed_out_at"),
  status: varchar("status", { length: 20 }).default("signed_up").notNull(), // signed_up, active, completed, no_show
});

export const patrolLogs = pgTable("patrol_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  patrolId: uuid("patrol_id")
    .references(() => patrols.id)
    .notNull(),
  authorId: uuid("author_id")
    .references(() => users.id)
    .notNull(),
  content: text("content").notNull(),
  location: varchar("location", { length: 200 }),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  attachments: json("attachments").$type<string[]>(),
});

// Live Unit Tracker
export const unitStatuses = pgTable("unit_statuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  departmentMemberId: uuid("department_member_id")
    .references(() => departmentMembers.id)
    .notNull(),
  status: unitStatusEnum("status").notNull(),
  location: varchar("location", { length: 200 }),
  notes: text("notes"),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  updatedBy: uuid("updated_by")
    .references(() => users.id)
    .notNull(),
});

// CDN File Manager
export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id").references(() => servers.id),
  uploadedBy: uuid("uploaded_by")
    .references(() => users.id)
    .notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  size: integer("size").notNull(), // Bytes
  path: text("path").notNull(),
  url: text("url").notNull(),
  visibility: fileVisibilityEnum("visibility").default("private").notNull(),
  expiresAt: timestamp("expires_at"),
  downloads: integer("downloads").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

// Analytics & Reporting
export const analytics = pgTable("analytics", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id")
    .references(() => servers.id)
    .notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  eventData: json("event_data").$type<Record<string, any>>(),
  userId: uuid("user_id").references(() => users.id),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Public pages for server customization
export const publicPages = pgTable("public_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id")
    .references(() => servers.id)
    .notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  content: text("content"),
  isPublished: boolean("is_published").default(false).notNull(),
  metaDescription: text("meta_description"),
  orderIndex: integer("order_index").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User settings and preferences
export const userSettings = pgTable("user_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  serverId: uuid("server_id").references(() => servers.id), // NULL for global settings
  settings: json("settings").$type<UserPreferences>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Analytics aggregations for performance
export const analyticsAggregates = pgTable("analytics_aggregates", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id")
    .references(() => servers.id)
    .notNull(),
  metricType: varchar("metric_type", { length: 50 }).notNull(),
  dimension: varchar("dimension", { length: 50 }).notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  value: integer("value").notNull(),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Custom reports configuration
export const customReports = pgTable("custom_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id")
    .references(() => servers.id)
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  config: json("config").$type<ReportConfig>(),
  schedule: varchar("schedule", { length: 20 }), // 'daily', 'weekly', 'monthly'
  recipients: json("recipients").$type<string[]>(),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Server configuration templates
export const serverTemplates = pgTable("server_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id")
    .references(() => servers.id)
    .notNull(),
  templateType: varchar("template_type", { length: 50 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  config: json("config").$type<Record<string, any>>(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Sessions for custom auth
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  token: text("token").unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsed: timestamp("last_used").defaultNow().notNull(),
});

// Type definitions for JSON fields
export interface ServerSettings {
  branding?: {
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
    favicon?: string;
  };
  features?: {
    applications?: boolean;
    roster?: boolean;
    training?: boolean;
    patrols?: boolean;
    unitTracker?: boolean;
    fileManager?: boolean;
    analytics?: boolean;
    publicPages?: boolean;
  };
  limits?: {
    maxDepartments?: number;
    maxMembers?: number;
    storageLimit?: number; // MB
  };
  notifications?: {
    webhookUrl?: string;
    channels?: {
      applications?: string;
      roster?: string;
      training?: string;
    };
  };
}

export interface DepartmentSettings {
  autoRole?: string; // Discord role ID
  ranks?: string[];
  unitPrefix?: string;
  permissions?: {
    canViewRoster?: boolean;
    canEditRoster?: boolean;
    canManageApplications?: boolean;
  };
}

export interface ApplicationField {
  id: string;
  type:
    | "text"
    | "textarea"
    | "select"
    | "checkbox"
    | "radio"
    | "number"
    | "email"
    | "date";
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // For select, radio
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface ApplicationFormSettings {
  autoApprove?: boolean;
  requiresReview?: boolean;
  notifyWebhook?: boolean;
  assignRole?: string; // Discord role ID
  thankYouMessage?: string;
  redirectUrl?: string;
}

export interface UserPreferences {
  theme?: "light" | "dark" | "auto";
  timezone?: string;
  language?: string;
  dashboardLayout?: string[];
  notifications?: {
    email?: boolean;
    discord?: boolean;
    applicationUpdates?: boolean;
    rosterChanges?: boolean;
    trainingReminders?: boolean;
    systemAlerts?: boolean;
  };
  privacy?: {
    profileVisible?: boolean;
    contactVisible?: boolean;
    activityVisible?: boolean;
  };
}

export interface ReportConfig {
  metrics: string[];
  filters: {
    dateRange?: {
      start: string;
      end: string;
    };
    departments?: string[];
    userRoles?: string[];
    eventTypes?: string[];
  };
  visualization: {
    type: "chart" | "table" | "summary";
    chartType?: "line" | "bar" | "pie" | "area";
    groupBy?: string;
    sortBy?: string;
  };
  format?: "pdf" | "csv" | "json" | "excel";
}

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  serverMembers: many(serverMembers),
  sessions: many(sessions),
  applications: many(applications),
  createdApplicationForms: many(applicationForms),
  reviewedApplications: many(applications, { relationName: "reviewer" }),
}));

export const serversRelations = relations(servers, ({ many }) => ({
  members: many(serverMembers),
  departments: many(departments),
  applicationForms: many(applicationForms),
  files: many(files),
  analytics: many(analytics),
}));

export const serverMembersRelations = relations(
  serverMembers,
  ({ one, many }) => ({
    user: one(users, {
      fields: [serverMembers.userId],
      references: [users.id],
    }),
    server: one(servers, {
      fields: [serverMembers.serverId],
      references: [servers.id],
    }),
    departmentMembers: many(departmentMembers),
  })
);

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  server: one(servers, {
    fields: [departments.serverId],
    references: [servers.id],
  }),
  members: many(departmentMembers),
  applicationForms: many(applicationForms),
  certifications: many(certifications),
}));

export const departmentMembersRelations = relations(
  departmentMembers,
  ({ one, many }) => ({
    department: one(departments, {
      fields: [departmentMembers.departmentId],
      references: [departments.id],
    }),
    serverMember: one(serverMembers, {
      fields: [departmentMembers.serverMemberId],
      references: [serverMembers.id],
    }),
    certifications: many(memberCertifications),
    unitStatus: many(unitStatuses),
  })
);

export const applicationFormsRelations = relations(
  applicationForms,
  ({ one, many }) => ({
    server: one(servers, {
      fields: [applicationForms.serverId],
      references: [servers.id],
    }),
    department: one(departments, {
      fields: [applicationForms.departmentId],
      references: [departments.id],
    }),
    createdBy: one(users, {
      fields: [applicationForms.createdBy],
      references: [users.id],
    }),
    applications: many(applications),
  })
);

export const applicationsRelations = relations(applications, ({ one }) => ({
  form: one(applicationForms, {
    fields: [applications.formId],
    references: [applicationForms.id],
  }),
  applicant: one(users, {
    fields: [applications.applicantId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [applications.reviewedBy],
    references: [users.id],
    relationName: "reviewer",
  }),
}));

// New table relations
export const publicPagesRelations = relations(publicPages, ({ one }) => ({
  server: one(servers, {
    fields: [publicPages.serverId],
    references: [servers.id],
  }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
  server: one(servers, {
    fields: [userSettings.serverId],
    references: [servers.id],
  }),
}));

export const analyticsAggregatesRelations = relations(
  analyticsAggregates,
  ({ one }) => ({
    server: one(servers, {
      fields: [analyticsAggregates.serverId],
      references: [servers.id],
    }),
  })
);

export const customReportsRelations = relations(customReports, ({ one }) => ({
  server: one(servers, {
    fields: [customReports.serverId],
    references: [servers.id],
  }),
  createdBy: one(users, {
    fields: [customReports.createdBy],
    references: [users.id],
  }),
}));

export const serverTemplatesRelations = relations(
  serverTemplates,
  ({ one }) => ({
    server: one(servers, {
      fields: [serverTemplates.serverId],
      references: [servers.id],
    }),
  })
);
