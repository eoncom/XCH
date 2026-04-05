import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import * as Minio from 'minio';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storageType: 'filesystem' | 'minio';
  private readonly uploadDir: string;
  private minioClient: Minio.Client | null = null;
  private minioBucket: string;

  constructor(private configService: ConfigService) {
    this.storageType = this.configService.get('STORAGE_TYPE', 'minio') as 'filesystem' | 'minio';
    this.uploadDir = this.configService.get('UPLOAD_DIR', './uploads');
    this.minioBucket = this.configService.get('MINIO_BUCKET', 'xch-storage');

    if (this.storageType === 'filesystem') {
      this.ensureUploadDir();
    } else if (this.storageType === 'minio') {
      this.initMinioClient();
    }
  }

  private initMinioClient() {
    try {
      const endpoint = this.configService.get('MINIO_ENDPOINT', 'minio');
      const port = parseInt(this.configService.get('MINIO_PORT', '9000'), 10);
      const accessKey = this.configService.get('MINIO_ACCESS_KEY');
      const secretKey = this.configService.get('MINIO_SECRET_KEY');
      if (!accessKey || !secretKey) {
        this.logger.error('MINIO_ACCESS_KEY and MINIO_SECRET_KEY must be set in environment');
        return;
      }
      const useSSL = this.configService.get('MINIO_USE_SSL', 'false') === 'true';

      this.minioClient = new Minio.Client({
        endPoint: endpoint,
        port: port,
        useSSL: useSSL,
        accessKey: accessKey,
        secretKey: secretKey,
      });

      this.logger.log(`MinIO client initialized: ${endpoint}:${port} (SSL: ${useSSL})`);
      this.ensureBucket();
    } catch (error) {
      this.logger.error('Failed to initialize MinIO client', error);
      throw error;
    }
  }

  private async ensureBucket() {
    if (!this.minioClient) {
      this.logger.error('MinIO client not initialized, cannot ensure bucket');
      return;
    }

    try {
      const exists = await this.minioClient.bucketExists(this.minioBucket);
      if (!exists) {
        await this.minioClient.makeBucket(this.minioBucket, 'us-east-1');
        this.logger.log(`MinIO bucket created: ${this.minioBucket}`);
      } else {
        this.logger.log(`MinIO bucket exists: ${this.minioBucket}`);
      }
    } catch (error) {
      this.logger.error(`Failed to ensure bucket: ${this.minioBucket}`, error);
    }
  }

  private async ensureUploadDir() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(path.join(this.uploadDir, 'floor-plans'), { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create upload directory', error);
    }
  }

  /**
   * Upload file to storage (filesystem or MinIO)
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string,
    filename: string,
  ): Promise<string> {
    if (this.storageType === 'minio') {
      return this.uploadToMinio(file, folder, filename);
    } else {
      return this.uploadToFilesystem(file, folder, filename);
    }
  }

  /**
   * Upload to filesystem
   */
  private async uploadToFilesystem(
    file: Express.Multer.File,
    folder: string,
    filename: string,
  ): Promise<string> {
    const folderPath = path.join(this.uploadDir, folder);
    await fs.mkdir(folderPath, { recursive: true });

    const filePath = path.join(folderPath, filename);
    await fs.writeFile(filePath, file.buffer);

    this.logger.log(`File uploaded to filesystem: ${filePath}`);
    return `/${folder}/${filename}`;
  }

  /**
   * Upload to MinIO (S3-compatible)
   */
  private async uploadToMinio(
    file: Express.Multer.File,
    folder: string,
    filename: string,
  ): Promise<string> {
    if (!this.minioClient) {
      this.logger.error('MinIO client not initialized');
      throw new Error('MinIO client not initialized');
    }

    try {
      const objectName = `${folder}/${filename}`;
      const metadata = {
        'Content-Type': file.mimetype,
        'Content-Length': file.size.toString(),
      };

      await this.minioClient.putObject(
        this.minioBucket,
        objectName,
        file.buffer,
        file.size,
        metadata,
      );

      this.logger.log(`File uploaded to MinIO: ${objectName} (${file.size} bytes)`);
      return `/${folder}/${filename}`;
    } catch (error) {
      this.logger.error(`Failed to upload to MinIO: ${folder}/${filename}`, error);
      throw error;
    }
  }

  /**
   * Get file URL
   *
   * When MINIO_PUBLIC_URL is set:
   *   - Uses that URL directly (e.g., https://xch.example.com/storage)
   * When behind nginx proxy (default):
   *   - Returns /storage/{bucket}/{path} (relative URL, routed by nginx)
   * Fallback (dev without nginx):
   *   - Returns http://localhost:9000/{bucket}/{path}
   */
  getFileUrl(filePath: string): string {
    if (this.storageType === 'minio') {
      const minioPublicUrl = this.configService.get('MINIO_PUBLIC_URL');
      const bucket = this.configService.get('MINIO_BUCKET', 'xch-storage');

      if (minioPublicUrl) {
        // Explicit public URL (e.g., /storage or https://cdn.example.com)
        return `${minioPublicUrl}/${bucket}${filePath}`;
      }

      // Default: relative URL through nginx /storage/ route
      // nginx rewrites /storage/* → minio:9000/*
      return `/storage/${bucket}${filePath}`;
    } else {
      const baseUrl = this.configService.get('APP_URL', '');
      return `${baseUrl}/uploads${filePath}`;
    }
  }

  /**
   * Delete file from storage
   */
  async deleteFile(filePath: string): Promise<void> {
    if (this.storageType === 'minio') {
      await this.deleteFromMinio(filePath);
    } else {
      await this.deleteFromFilesystem(filePath);
    }
  }

  private async deleteFromFilesystem(filePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.uploadDir, filePath);
      await fs.unlink(fullPath);
      this.logger.log(`File deleted from filesystem: ${fullPath}`);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${filePath}`, error);
    }
  }

  private async deleteFromMinio(filePath: string): Promise<void> {
    if (!this.minioClient) {
      this.logger.error('MinIO client not initialized');
      return;
    }

    try {
      // Remove leading slash if present
      const objectName = filePath.startsWith('/') ? filePath.substring(1) : filePath;
      await this.minioClient.removeObject(this.minioBucket, objectName);
      this.logger.log(`File deleted from MinIO: ${objectName}`);
    } catch (error) {
      this.logger.error(`Failed to delete from MinIO: ${filePath}`, error);
    }
  }

  /**
   * Delete all files under a given prefix (folder path).
   * Best-effort: logs errors but does not throw.
   */
  async deleteByPrefix(prefix: string): Promise<number> {
    if (this.storageType === 'minio') {
      return this.deleteMinioPrefix(prefix);
    } else {
      return this.deleteFilesystemPrefix(prefix);
    }
  }

  private async deleteMinioPrefix(prefix: string): Promise<number> {
    if (!this.minioClient) {
      this.logger.error('MinIO client not initialized, cannot delete by prefix');
      return 0;
    }

    const normalizedPrefix = prefix.startsWith('/') ? prefix.substring(1) : prefix;
    let deletedCount = 0;

    try {
      const objectsList: string[] = [];
      const stream = this.minioClient.listObjectsV2(this.minioBucket, normalizedPrefix, true);

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (obj) => {
          if (obj.name) {
            objectsList.push(obj.name);
          }
        });
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve());
      });

      if (objectsList.length === 0) {
        this.logger.log(`No objects found with prefix: ${normalizedPrefix}`);
        return 0;
      }

      // Delete objects one by one for reliable error handling
      for (const objectName of objectsList) {
        try {
          await this.minioClient.removeObject(this.minioBucket, objectName);
          deletedCount++;
        } catch (error) {
          this.logger.error(`Failed to delete MinIO object: ${objectName}`, error);
        }
      }

      this.logger.log(`Deleted ${deletedCount}/${objectsList.length} objects with prefix: ${normalizedPrefix}`);
    } catch (error) {
      this.logger.error(`Failed to list/delete objects with prefix: ${normalizedPrefix}`, error);
    }

    return deletedCount;
  }

  private async deleteFilesystemPrefix(prefix: string): Promise<number> {
    try {
      const folderPath = path.join(this.uploadDir, prefix);
      await fs.rm(folderPath, { recursive: true, force: true });
      this.logger.log(`Deleted filesystem folder: ${folderPath}`);
      return 1;
    } catch (error) {
      this.logger.error(`Failed to delete filesystem folder for prefix: ${prefix}`, error);
      return 0;
    }
  }

  /**
   * Generate unique filename with timestamp
   */
  generateFilename(originalName: string, prefix?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(originalName);
    const basename = path.basename(originalName, ext).replace(/[^a-z0-9]/gi, '-');

    return prefix
      ? `${prefix}-${timestamp}-${random}-${basename}${ext}`
      : `${timestamp}-${random}-${basename}${ext}`;
  }
}
