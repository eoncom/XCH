import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storageType: 'filesystem' | 'minio';
  private readonly uploadDir: string;

  constructor(private configService: ConfigService) {
    this.storageType = this.configService.get('STORAGE_TYPE', 'filesystem') as 'filesystem' | 'minio';
    this.uploadDir = this.configService.get('UPLOAD_DIR', './uploads');

    if (this.storageType === 'filesystem') {
      this.ensureUploadDir();
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
   * TODO: Implement MinIO SDK integration when STORAGE_TYPE=minio
   */
  private async uploadToMinio(
    file: Express.Multer.File,
    folder: string,
    filename: string,
  ): Promise<string> {
    // For now, fallback to filesystem
    this.logger.warn('MinIO not implemented, using filesystem fallback');
    return this.uploadToFilesystem(file, folder, filename);

    // TODO: Implement with minio SDK
    // const minioClient = new Client({ ... });
    // await minioClient.putObject(bucket, `${folder}/${filename}`, file.buffer);
    // return `https://minio.xch.app/${bucket}/${folder}/${filename}`;
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
    // TODO: Implement MinIO deletion
    this.logger.warn('MinIO deletion not implemented');
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
