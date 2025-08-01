import { IService } from "../../types/index";
import { DatabaseService } from "../database/database-service";
import { files } from "../../database/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";

export type FileVisibility = "public" | "private" | "server";

export interface FileRecord {
  id: string;
  serverId?: string;
  uploadedBy: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
  visibility: FileVisibility;
  expiresAt?: Date;
  downloads: number;
  isActive: boolean;
  uploadedAt: Date;
}

export interface UploadFileData {
  serverId?: string;
  uploadedBy: string;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
  visibility?: FileVisibility;
  expiresAt?: Date;
}

export interface FileStats {
  totalFiles: number;
  totalSize: number;
  publicFiles: number;
  privateFiles: number;
  serverFiles: number;
  expiredFiles: number;
}

/**
 * Custom CDN File Manager Service
 * Handles file uploads, storage, and access controls
 */
export class FileManagerService implements IService {
  public readonly name = "file-manager-service";

  private ready = false;
  private databaseService!: DatabaseService;
  private readonly uploadPath: string = process.env.UPLOAD_PATH || "./uploads";
  private readonly baseUrl: string =
    process.env.CDN_BASE_URL || "http://localhost:3000/cdn";
  private readonly maxFileSize: number = parseInt(
    process.env.MAX_FILE_SIZE || "10485760"
  ); // 10MB default
  private readonly allowedMimeTypes: string[] = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  public async initialise(): Promise<void> {
    if (this.ready) {
      return;
    }

    console.log("📁 Initialising File Manager Service...");

    // Ensure upload directory exists
    await this.ensureUploadDirectory();

    this.ready = true;
    console.log("✅ File Manager Service ready");
  }

  public async shutdown(): Promise<void> {
    if (!this.ready) {
      return;
    }

    console.log("📁 Shutting down File Manager Service...");
    this.ready = false;
    console.log("✅ File Manager Service shut down");
  }

  public isReady(): boolean {
    return this.ready;
  }

  public setDatabaseService(databaseService: DatabaseService): void {
    this.databaseService = databaseService;
  }

  /**
   * Upload a file
   */
  public async uploadFile(data: UploadFileData): Promise<FileRecord> {
    // Validate file size
    if (data.buffer.length > this.maxFileSize) {
      throw new Error(
        `File size exceeds maximum allowed size of ${this.maxFileSize} bytes`
      );
    }

    // Validate MIME type
    if (!this.allowedMimeTypes.includes(data.mimeType)) {
      throw new Error(`File type ${data.mimeType} is not allowed`);
    }

    // Generate unique filename
    const fileExtension = this.getFileExtension(data.originalName);
    const uniqueFilename = this.generateUniqueFilename(fileExtension);
    const filePath = path.join(this.uploadPath, uniqueFilename);

    // Save file to disk
    await fs.writeFile(filePath, data.buffer);

    // Generate public URL
    const fileUrl = `${this.baseUrl}/${uniqueFilename}`;

    // Save to database
    const db = this.databaseService.getDb();
    const [fileRecord] = await db
      .insert(files)
      .values({
        serverId: data.serverId,
        uploadedBy: data.uploadedBy,
        filename: uniqueFilename,
        originalName: data.originalName,
        mimeType: data.mimeType,
        size: data.buffer.length,
        path: filePath,
        url: fileUrl,
        visibility: data.visibility || "private",
        expiresAt: data.expiresAt,
        downloads: 0,
        isActive: true,
      })
      .returning();

    return fileRecord as FileRecord;
  }

  /**
   * Get file by ID
   */
  public async getFile(fileId: string): Promise<FileRecord | null> {
    const db = this.databaseService.getDb();

    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    return file ? (file as FileRecord) : null;
  }

  /**
   * Get file content as buffer
   */
  public async getFileContent(fileId: string): Promise<Buffer | null> {
    const file = await this.getFile(fileId);
    if (!file?.isActive) {
      return null;
    }

    // Check if file has expired
    if (file.expiresAt && file.expiresAt < new Date()) {
      return null;
    }

    try {
      const content = await fs.readFile(file.path);

      // Increment download counter
      await this.incrementDownloadCount(fileId);

      return content;
    } catch (error) {
      console.error("Error reading file:", error);
      return null;
    }
  }

  /**
   * Get files by user
   */
  public async getUserFiles(
    userId: string,
    visibility?: FileVisibility
  ): Promise<FileRecord[]> {
    const db = this.databaseService.getDb();

    const conditions = [eq(files.uploadedBy, userId), eq(files.isActive, true)];
    if (visibility) {
      conditions.push(eq(files.visibility, visibility));
    }

    const userFiles = await db
      .select()
      .from(files)
      .where(and(...conditions))
      .orderBy(desc(files.uploadedAt));

    return userFiles as FileRecord[];
  }

  /**
   * Get files by server
   */
  public async getServerFiles(
    serverId: string,
    visibility?: FileVisibility
  ): Promise<FileRecord[]> {
    const db = this.databaseService.getDb();

    const conditions = [eq(files.serverId, serverId), eq(files.isActive, true)];
    if (visibility) {
      conditions.push(eq(files.visibility, visibility));
    }

    const serverFiles = await db
      .select()
      .from(files)
      .where(and(...conditions))
      .orderBy(desc(files.uploadedAt));

    return serverFiles as FileRecord[];
  }

  /**
   * Get public files
   */
  public async getPublicFiles(limit: number = 50): Promise<FileRecord[]> {
    const db = this.databaseService.getDb();

    const publicFiles = await db
      .select()
      .from(files)
      .where(and(eq(files.visibility, "public"), eq(files.isActive, true)))
      .orderBy(desc(files.uploadedAt))
      .limit(limit);

    return publicFiles as FileRecord[];
  }

  /**
   * Update file visibility
   */
  public async updateFileVisibility(
    fileId: string,
    visibility: FileVisibility
  ): Promise<FileRecord | null> {
    const db = this.databaseService.getDb();

    const [updated] = await db
      .update(files)
      .set({ visibility })
      .where(eq(files.id, fileId))
      .returning();

    return updated ? (updated as FileRecord) : null;
  }

  /**
   * Delete file
   */
  public async deleteFile(fileId: string): Promise<boolean> {
    const file = await this.getFile(fileId);
    if (!file) {
      return false;
    }

    const db = this.databaseService.getDb();

    // Mark as inactive in database
    await db.update(files).set({ isActive: false }).where(eq(files.id, fileId));

    // Delete physical file
    try {
      await fs.unlink(file.path);
    } catch (error) {
      console.error("Error deleting physical file:", error);
      // Don't fail the operation if physical file deletion fails
    }

    return true;
  }

  /**
   * Get file statistics
   */
  public async getFileStats(serverId?: string): Promise<FileStats> {
    const db = this.databaseService.getDb();

    const conditions = [eq(files.isActive, true)];
    if (serverId) {
      conditions.push(eq(files.serverId, serverId));
    }

    const allFiles = await db
      .select({
        visibility: files.visibility,
        size: files.size,
        expiresAt: files.expiresAt,
      })
      .from(files)
      .where(and(...conditions));

    const stats: FileStats = {
      totalFiles: allFiles.length,
      totalSize: allFiles.reduce((sum, file) => sum + file.size, 0),
      publicFiles: 0,
      privateFiles: 0,
      serverFiles: 0,
      expiredFiles: 0,
    };

    const now = new Date();
    allFiles.forEach((file) => {
      switch (file.visibility) {
        case "public":
          stats.publicFiles++;
          break;
        case "private":
          stats.privateFiles++;
          break;
        case "server":
          stats.serverFiles++;
          break;
      }

      if (file.expiresAt && file.expiresAt < now) {
        stats.expiredFiles++;
      }
    });

    return stats;
  }

  /**
   * Clean up expired files
   */
  public async cleanupExpiredFiles(): Promise<number> {
    const db = this.databaseService.getDb();
    const now = new Date();

    const expiredFiles = await db
      .select()
      .from(files)
      .where(
        and(
          eq(files.isActive, true),
          eq(files.expiresAt, now) // This should use a comparison operator
        )
      );

    let deletedCount = 0;

    for (const file of expiredFiles) {
      const success = await this.deleteFile(file.id);
      if (success) {
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Search files
   */
  public async searchFiles(
    query: string,
    serverId?: string,
    visibility?: FileVisibility
  ): Promise<FileRecord[]> {
    const db = this.databaseService.getDb();

    const conditions = [eq(files.isActive, true)];
    if (serverId) {
      conditions.push(eq(files.serverId, serverId));
    }
    if (visibility) {
      conditions.push(eq(files.visibility, visibility));
    }

    const allFiles = await db
      .select()
      .from(files)
      .where(and(...conditions))
      .orderBy(desc(files.uploadedAt));

    // Filter by query (filename or original name)
    const filteredFiles = allFiles.filter((file) => {
      const searchText = query.toLowerCase();
      return (
        file.filename.toLowerCase().includes(searchText) ||
        file.originalName.toLowerCase().includes(searchText)
      );
    });

    return filteredFiles as FileRecord[];
  }

  /**
   * Check if user can access file
   */
  public async canUserAccessFile(
    fileId: string,
    userId: string,
    serverId?: string
  ): Promise<boolean> {
    const file = await this.getFile(fileId);
    if (!file?.isActive) {
      return false;
    }

    // Check if file has expired
    if (file.expiresAt && file.expiresAt < new Date()) {
      return false;
    }

    // Public files are accessible to everyone
    if (file.visibility === "public") {
      return true;
    }

    // Private files are only accessible to the uploader
    if (file.visibility === "private") {
      return file.uploadedBy === userId;
    }

    // Server files are accessible to server members
    if (file.visibility === "server") {
      return file.serverId === serverId;
    }

    return false;
  }

  /**
   * Generate file thumbnail (for images)
   */
  public async generateThumbnail(fileId: string): Promise<string | null> {
    const file = await this.getFile(fileId);
    if (!file?.mimeType?.startsWith("image/")) {
      return null;
    }

    // This is a placeholder - in a real implementation, you'd use an image processing library
    // like Sharp to generate thumbnails
    return `${this.baseUrl}/thumbnails/${file.filename}`;
  }

  /**
   * Increment download count
   */
  private async incrementDownloadCount(fileId: string): Promise<void> {
    const db = this.databaseService.getDb();

    await db
      .update(files)
      .set({ downloads: sql`${files.downloads} + 1` })
      .where(eq(files.id, fileId));
  }

  /**
   * Ensure upload directory exists
   */
  private async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.access(this.uploadPath);
    } catch {
      await fs.mkdir(this.uploadPath, { recursive: true });
    }
  }

  /**
   * Generate unique filename
   */
  private generateUniqueFilename(extension: string): string {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(16).toString("hex");
    return `${timestamp}-${randomBytes}${extension}`;
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf(".");
    return lastDot > -1 ? filename.substring(lastDot) : "";
  }
}
