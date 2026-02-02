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
      const accessKey = this.configService.get('MINIO_ACCESS_KEY', 'minioadmin');
      const secretKey = this.configService.get('MINIO_SECRET_KEY', 'minioadmin');
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
   */
  getFileUrl(filePath: string): string {
    if (this.storageType === 'minio') {
      // Use MINIO_PUBLIC_URL for browser-accessible URL (e.g., https://xch.eoncom.io:9000)
      // Falls back to internal URL if not set (for development)
      const minioPublicUrl = this.configService.get('MINIO_PUBLIC_URL');
      const minioEndpoint = this.configService.get('MINIO_ENDPOINT', 'localhost');
      const minioPort = this.configService.get('MINIO_PORT', '9000');
      const minioUrl = minioPublicUrl || `http://${minioEndpoint}:${minioPort}`;
      const bucket = this.configService.get('MINIO_BUCKET', 'xch-storage');
      return `${minioUrl}/${bucket}${filePath}`;
    } else {
      const baseUrl = this.configService.get('APP_URL', 'http://localhost:3000');
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
