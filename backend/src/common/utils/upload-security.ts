import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Allowed MIME types for file uploads.
 * Organized by category for flexible validation.
 */
export const ALLOWED_MIME_TYPES = {
  // Images
  images: [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/tiff',
  ],
  // Documents
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
  ],
  // Archives
  archives: [
    'application/zip',
    'application/x-zip-compressed',
    'application/gzip',
    'application/x-tar',
  ],
  // Backup files (ZIP only)
  backup: [
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream', // Some browsers send ZIP as octet-stream
  ],
};

/**
 * All allowed MIME types for general attachments (images + documents + archives).
 */
export const ATTACHMENT_ALLOWED_MIMES = [
  ...ALLOWED_MIME_TYPES.images,
  ...ALLOWED_MIME_TYPES.documents,
  ...ALLOWED_MIME_TYPES.archives,
];

/**
 * Dangerous file extensions that should NEVER be uploaded.
 */
const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif',
  '.vbs', '.vbe', '.js', '.jse', '.ws', '.wsf', '.wsc', '.wsh',
  '.ps1', '.psm1', '.psd1',
  '.sh', '.bash', '.csh',
  '.php', '.phtml', '.php3', '.php4', '.php5',
  '.asp', '.aspx',
  '.dll', '.sys', '.drv',
  '.jar', '.class',
  '.py', '.pyc', '.pyo',
  '.rb',
  '.pl', '.cgi',
  '.swf',
  '.htaccess', '.htpasswd',
];

/**
 * Multer file filter factory for attachment uploads.
 * Validates MIME type against allowed list and blocks dangerous extensions.
 */
export function attachmentFileFilter(
  _req: Request,
  file: { mimetype: string; originalname: string; [key: string]: any },
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  // Check MIME type
  if (!ATTACHMENT_ALLOWED_MIMES.includes(file.mimetype)) {
    return callback(
      new BadRequestException(
        `Type de fichier non autorisé: ${file.mimetype}. Types acceptés: images, PDF, documents Office, CSV, ZIP.`,
      ),
      false,
    );
  }

  // Check file extension
  const ext = '.' + (file.originalname.split('.').pop() || '').toLowerCase();
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return callback(
      new BadRequestException(
        `Extension de fichier bloquée: ${ext}. Ce type de fichier n'est pas autorisé pour des raisons de sécurité.`,
      ),
      false,
    );
  }

  callback(null, true);
}

/**
 * Multer file filter for backup restore (ZIP files only).
 */
export function backupFileFilter(
  _req: Request,
  file: { mimetype: string; originalname: string; [key: string]: any },
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!ALLOWED_MIME_TYPES.backup.includes(file.mimetype)) {
    return callback(
      new BadRequestException(
        `Type de fichier non autorisé pour la restauration: ${file.mimetype}. Seuls les fichiers ZIP sont acceptés.`,
      ),
      false,
    );
  }

  const ext = '.' + (file.originalname.split('.').pop() || '').toLowerCase();
  if (ext !== '.zip') {
    return callback(
      new BadRequestException(
        `Extension de fichier invalide: ${ext}. Seuls les fichiers .zip sont acceptés.`,
      ),
      false,
    );
  }

  callback(null, true);
}

/**
 * Sanitize a string value for safe Excel export.
 * Prevents formula injection (CSV injection / DDE attacks).
 * Prefixes dangerous characters with a single quote to prevent Excel from interpreting as formula.
 */
export function sanitizeForExcel(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Characters that trigger formula interpretation in Excel/LibreOffice
  if (/^[=+\-@\t\r]/.test(str)) {
    return "'" + str;
  }
  return str;
}
