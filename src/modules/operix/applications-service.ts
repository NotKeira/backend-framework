import { IService } from "../../types/index";
import { DatabaseService } from "../database/database-service";
import {
  applicationForms,
  applications,
  ApplicationField,
  ApplicationFormSettings,
  users,
} from "../../database/schema";
import { eq, and, desc, count } from "drizzle-orm";

export type ApplicationStatus =
  | "pending"
  | "approved"
  | "denied"
  | "under_review";
export type ApplicationType = "staff" | "loa" | "ra" | "department" | "custom";

export interface ApplicationForm {
  id: string;
  serverId: string;
  departmentId?: string;
  title: string;
  description?: string;
  type: ApplicationType;
  fields: ApplicationField[];
  settings?: ApplicationFormSettings;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Application {
  id: string;
  formId: string;
  applicantId: string;
  responses: Record<string, any>;
  status: ApplicationStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  tags?: string[];
  submittedAt: Date;
  updatedAt: Date;
}

export interface ApplicationWithDetails extends Application {
  form: ApplicationForm;
  applicant: {
    id: string;
    username: string;
    avatar?: string;
  };
  reviewer?: {
    id: string;
    username: string;
  };
}

export interface CreateApplicationFormData {
  serverId: string;
  departmentId?: string;
  title: string;
  description?: string;
  type: ApplicationType;
  fields: ApplicationField[];
  settings?: ApplicationFormSettings;
}

export interface SubmitApplicationData {
  formId: string;
  applicantId: string;
  responses: Record<string, any>;
}

export interface ReviewApplicationData {
  applicationId: string;
  reviewerId: string;
  status: ApplicationStatus;
  reviewNotes?: string;
  tags?: string[];
}

/**
 * Service for managing application forms and submissions
 */
export class ApplicationsService implements IService {
  public readonly name = "applications-service";

  private ready = false;
  private databaseService!: DatabaseService;

  public async initialise(): Promise<void> {
    if (this.ready) {
      return;
    }

    console.log("📝 Initialising Applications Service...");
    this.ready = true;
    console.log("✅ Applications Service ready");
  }

  public async shutdown(): Promise<void> {
    if (!this.ready) {
      return;
    }

    console.log("📝 Shutting down Applications Service...");
    this.ready = false;
    console.log("✅ Applications Service shut down");
  }

  public isReady(): boolean {
    return this.ready;
  }

  public setDatabaseService(databaseService: DatabaseService): void {
    this.databaseService = databaseService;
  }

  /**
   * Create a new application form
   */
  public async createApplicationForm(
    data: CreateApplicationFormData,
    createdBy: string
  ): Promise<ApplicationForm> {
    const db = this.databaseService.getDb();

    const [form] = await db
      .insert(applicationForms)
      .values({
        ...data,
        createdBy,
        isActive: true,
      })
      .returning();

    return form as ApplicationForm;
  }

  /**
   * Get application forms for a server
   */
  public async getServerApplicationForms(
    serverId: string,
    activeOnly: boolean = true
  ): Promise<ApplicationForm[]> {
    const db = this.databaseService.getDb();

    const conditions = [eq(applicationForms.serverId, serverId)];
    if (activeOnly) {
      conditions.push(eq(applicationForms.isActive, true));
    }

    const forms = await db
      .select()
      .from(applicationForms)
      .where(and(...conditions))
      .orderBy(desc(applicationForms.createdAt));

    return forms as ApplicationForm[];
  }

  /**
   * Get application form by ID
   */
  public async getApplicationForm(
    formId: string
  ): Promise<ApplicationForm | null> {
    const db = this.databaseService.getDb();

    const [form] = await db
      .select()
      .from(applicationForms)
      .where(eq(applicationForms.id, formId))
      .limit(1);

    return form ? (form as ApplicationForm) : null;
  }

  /**
   * Update an application form
   */
  public async updateApplicationForm(
    formId: string,
    updates: Partial<CreateApplicationFormData>
  ): Promise<ApplicationForm | null> {
    const db = this.databaseService.getDb();

    const [form] = await db
      .update(applicationForms)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(applicationForms.id, formId))
      .returning();

    return form ? (form as ApplicationForm) : null;
  }

  /**
   * Deactivate an application form
   */
  public async deactivateApplicationForm(formId: string): Promise<boolean> {
    const db = this.databaseService.getDb();

    const result = await db
      .update(applicationForms)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(applicationForms.id, formId));

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Submit a new application
   */
  public async submitApplication(
    data: SubmitApplicationData
  ): Promise<Application> {
    const db = this.databaseService.getDb();

    // Validate form exists and is active
    const form = await this.getApplicationForm(data.formId);
    if (!form?.isActive) {
      throw new Error("Application form not found or inactive");
    }

    // Validate responses against form fields
    this.validateApplicationResponses(form.fields, data.responses);

    const [application] = await db
      .insert(applications)
      .values({
        formId: data.formId,
        applicantId: data.applicantId,
        responses: data.responses,
        status: "pending",
      })
      .returning();

    return application as Application;
  }

  /**
   * Get applications for a form
   */
  public async getFormApplications(
    formId: string,
    status?: ApplicationStatus
  ): Promise<ApplicationWithDetails[]> {
    const db = this.databaseService.getDb();

    const conditions = [eq(applications.formId, formId)];
    if (status) {
      conditions.push(eq(applications.status, status));
    }

    const result = await db
      .select({
        application: applications,
        form: applicationForms,
        applicant: {
          id: users.id,
          username: users.username,
          avatar: users.avatar,
        },
      })
      .from(applications)
      .innerJoin(applicationForms, eq(applications.formId, applicationForms.id))
      .innerJoin(users, eq(applications.applicantId, users.id))
      .where(and(...conditions))
      .orderBy(desc(applications.submittedAt));

    return result.map((row) => ({
      ...row.application,
      form: row.form as ApplicationForm,
      applicant: row.applicant,
    })) as ApplicationWithDetails[];
  }

  /**
   * Get applications by server
   */
  public async getServerApplications(
    serverId: string,
    status?: ApplicationStatus
  ): Promise<ApplicationWithDetails[]> {
    const db = this.databaseService.getDb();

    const conditions = [eq(applicationForms.serverId, serverId)];
    if (status) {
      conditions.push(eq(applications.status, status));
    }

    const result = await db
      .select({
        application: applications,
        form: applicationForms,
        applicant: {
          id: users.id,
          username: users.username,
          avatar: users.avatar,
        },
      })
      .from(applications)
      .innerJoin(applicationForms, eq(applications.formId, applicationForms.id))
      .innerJoin(users, eq(applications.applicantId, users.id))
      .where(and(...conditions))
      .orderBy(desc(applications.submittedAt));

    return result.map((row) => ({
      ...row.application,
      form: row.form as ApplicationForm,
      applicant: row.applicant,
    })) as ApplicationWithDetails[];
  }

  /**
   * Get application by ID with details
   */
  public async getApplicationWithDetails(
    applicationId: string
  ): Promise<ApplicationWithDetails | null> {
    const db = this.databaseService.getDb();

    const result = await db
      .select({
        application: applications,
        form: applicationForms,
        applicant: {
          id: users.id,
          username: users.username,
          avatar: users.avatar,
        },
      })
      .from(applications)
      .innerJoin(applicationForms, eq(applications.formId, applicationForms.id))
      .innerJoin(users, eq(applications.applicantId, users.id))
      .where(eq(applications.id, applicationId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    if (!row) {
      return null;
    }

    return {
      ...row.application,
      form: row.form as ApplicationForm,
      applicant: row.applicant,
    } as ApplicationWithDetails;
  }

  /**
   * Review an application
   */
  public async reviewApplication(
    data: ReviewApplicationData
  ): Promise<Application | null> {
    const db = this.databaseService.getDb();

    const [application] = await db
      .update(applications)
      .set({
        status: data.status,
        reviewedBy: data.reviewerId,
        reviewedAt: new Date(),
        reviewNotes: data.reviewNotes,
        tags: data.tags,
        updatedAt: new Date(),
      })
      .where(eq(applications.id, data.applicationId))
      .returning();

    return application ? (application as Application) : null;
  }

  /**
   * Get application statistics for a server
   */
  public async getServerApplicationStats(serverId: string): Promise<{
    total: number;
    pending: number;
    approved: number;
    denied: number;
    under_review: number;
  }> {
    const db = this.databaseService.getDb();

    const stats = await db
      .select({
        status: applications.status,
        count: count(),
      })
      .from(applications)
      .innerJoin(applicationForms, eq(applications.formId, applicationForms.id))
      .where(eq(applicationForms.serverId, serverId))
      .groupBy(applications.status);

    const result = {
      total: 0,
      pending: 0,
      approved: 0,
      denied: 0,
      under_review: 0,
    };

    stats.forEach((stat) => {
      result[stat.status as keyof typeof result] = Number(stat.count);
      result.total += Number(stat.count);
    });

    return result;
  }

  /**
   * Get user's applications
   */
  public async getUserApplications(
    userId: string
  ): Promise<ApplicationWithDetails[]> {
    const db = this.databaseService.getDb();

    const result = await db
      .select({
        application: applications,
        form: applicationForms,
        applicant: {
          id: users.id,
          username: users.username,
          avatar: users.avatar,
        },
      })
      .from(applications)
      .innerJoin(applicationForms, eq(applications.formId, applicationForms.id))
      .innerJoin(users, eq(applications.applicantId, users.id))
      .where(eq(applications.applicantId, userId))
      .orderBy(desc(applications.submittedAt));

    return result.map((row) => ({
      ...row.application,
      form: row.form as ApplicationForm,
      applicant: row.applicant,
    })) as ApplicationWithDetails[];
  }

  /**
   * Delete an application
   */
  public async deleteApplication(applicationId: string): Promise<boolean> {
    const db = this.databaseService.getDb();

    const result = await db
      .delete(applications)
      .where(eq(applications.id, applicationId));

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Validate application responses against form fields
   */
  private validateApplicationResponses(
    fields: ApplicationField[],
    responses: Record<string, any>
  ): void {
    for (const field of fields) {
      if (
        field.required &&
        (!responses[field.id] || responses[field.id] === "")
      ) {
        throw new Error(`Field '${field.label}' is required`);
      }

      const value = responses[field.id];
      if (value !== undefined && value !== "") {
        this.validateFieldValue(field, value);
      }
    }
  }

  /**
   * Validate individual field value
   */
  private validateFieldValue(field: ApplicationField, value: any): void {
    switch (field.type) {
      case "email":
        this.validateEmailField(field, value);
        break;
      case "number":
        this.validateNumberField(field, value);
        break;
      case "text":
      case "textarea":
        this.validateTextField(field, value);
        break;
      case "select":
      case "radio":
        this.validateSelectField(field, value);
        break;
      case "checkbox":
        this.validateCheckboxField(field, value);
        break;
      case "date":
        this.validateDateField(field, value);
        break;
    }
  }

  private validateEmailField(field: ApplicationField, value: any): void {
    if (typeof value !== "string" || !this.isValidEmail(value)) {
      throw new Error(`Field '${field.label}' must be a valid email`);
    }
  }

  private validateNumberField(field: ApplicationField, value: any): void {
    if (typeof value !== "number" && isNaN(Number(value))) {
      throw new Error(`Field '${field.label}' must be a number`);
    }
    const numValue = Number(value);
    if (
      field.validation?.min !== undefined &&
      numValue < field.validation.min
    ) {
      throw new Error(
        `Field '${field.label}' must be at least ${field.validation.min}`
      );
    }
    if (
      field.validation?.max !== undefined &&
      numValue > field.validation.max
    ) {
      throw new Error(
        `Field '${field.label}' must be at most ${field.validation.max}`
      );
    }
  }

  private validateTextField(field: ApplicationField, value: any): void {
    if (typeof value !== "string") {
      throw new Error(`Field '${field.label}' must be text`);
    }
    if (
      field.validation?.min !== undefined &&
      value.length < field.validation.min
    ) {
      throw new Error(
        `Field '${field.label}' must be at least ${field.validation.min} characters`
      );
    }
    if (
      field.validation?.max !== undefined &&
      value.length > field.validation.max
    ) {
      throw new Error(
        `Field '${field.label}' must be at most ${field.validation.max} characters`
      );
    }
    if (
      field.validation?.pattern &&
      !new RegExp(field.validation.pattern).test(value)
    ) {
      throw new Error(`Field '${field.label}' format is invalid`);
    }
  }

  private validateSelectField(field: ApplicationField, value: any): void {
    if (!field.options?.includes(value)) {
      throw new Error(
        `Field '${field.label}' must be one of the provided options`
      );
    }
  }

  private validateCheckboxField(field: ApplicationField, value: any): void {
    if (typeof value !== "boolean") {
      throw new Error(`Field '${field.label}' must be true or false`);
    }
  }

  private validateDateField(field: ApplicationField, value: any): void {
    if (!(value instanceof Date) && isNaN(Date.parse(value))) {
      throw new Error(`Field '${field.label}' must be a valid date`);
    }
  }

  /**
   * Simple email validation
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
