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
 * Multer file filter for CSV imports (text/csv only).
 * Used by /api/assets/import* endpoints.
 */
export function csvFileFilter(
  _req: Request,
  file: { mimetype: string; originalname: string; [key: string]: any },
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  const allowed = [
    'text/csv',
    'application/csv',
    'text/plain',           // some clients send CSV as text/plain
    'application/vnd.ms-excel', // others send as ms-excel for .csv
  ];
  if (!allowed.includes(file.mimetype)) {
    return callback(
      new BadRequestException(
        `Type de fichier non autorisé pour l'import CSV: ${file.mimetype}. Seuls les .csv sont acceptés.`,
      ),
      false,
    );
  }
  const ext = '.' + (file.originalname.split('.').pop() || '').toLowerCase();
  if (ext !== '.csv' && ext !== '.txt') {
    return callback(
      new BadRequestException(
        `Extension de fichier invalide: ${ext}. Seuls les .csv sont acceptés.`,
      ),
      false,
    );
  }
  callback(null, true);
}

/**
 * Multer file filter for floor plan uploads (PDF, PNG, JPEG only).
 * Used by /api/floor-plans/* upload endpoints.
 */
export function floorPlanFileFilter(
  _req: Request,
  file: { mimetype: string; originalname: string; [key: string]: any },
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  const allowed = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
  ];
  if (!allowed.includes(file.mimetype)) {
    return callback(
      new BadRequestException(
        `Type de fichier non autorisé pour un plan d'étage: ${file.mimetype}. ` +
        `Types acceptés : PDF, PNG, JPEG.`,
      ),
      false,
    );
  }
  const ext = '.' + (file.originalname.split('.').pop() || '').toLowerCase();
  if (!['.pdf', '.png', '.jpg', '.jpeg'].includes(ext)) {
    return callback(
      new BadRequestException(
        `Extension de fichier invalide: ${ext}. Seuls les .pdf, .png, .jpg, .jpeg sont acceptés.`,
      ),
      false,
    );
  }
  callback(null, true);
}

/**
 * Multer file filter for PDF-only inputs (e.g. inspect-pdf endpoint).
 */
export function pdfOnlyFileFilter(
  _req: Request,
  file: { mimetype: string; originalname: string; [key: string]: any },
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (file.mimetype !== 'application/pdf') {
    return callback(
      new BadRequestException(
        `Type de fichier non autorisé: ${file.mimetype}. Seul le PDF est accepté ici.`,
      ),
      false,
    );
  }
  const ext = '.' + (file.originalname.split('.').pop() || '').toLowerCase();
  if (ext !== '.pdf') {
    return callback(
      new BadRequestException(
        `Extension de fichier invalide: ${ext}. Seul le .pdf est accepté ici.`,
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
 * Magic-byte signatures for common file formats.
 *
 * Multer fileFilter is called BEFORE the file buffer is available, so we can
 * only check mimetype + extension at that stage. To validate the actual file
 * content, services consuming the upload buffer should call
 * `validateMagicBytes(buffer, expectedKind)` before parsing/storing.
 *
 * Defense-in-depth against an attacker uploading a ".pdf" or ".zip" file
 * whose mimetype is correct but whose content is in fact an executable.
 */
const MAGIC_SIGNATURES = {
  zip:  [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06], [0x50, 0x4b, 0x07, 0x08]],
  pdf:  [[0x25, 0x50, 0x44, 0x46]], // %PDF
  png:  [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  jpeg: [[0xff, 0xd8, 0xff]],
  gif:  [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  webp: [[0x52, 0x49, 0x46, 0x46]], // RIFF (WEBP container, full check needs offset 8 = "WEBP")
} as const;

export type MagicKind = keyof typeof MAGIC_SIGNATURES;

/**
 * Check whether `buffer` starts with one of the known magic byte sequences for `kind`.
 * Returns true on match, false otherwise.
 */
export function bufferMatchesMagic(buffer: Buffer, kind: MagicKind): boolean {
  const signatures = MAGIC_SIGNATURES[kind];
  return signatures.some((sig) =>
    sig.every((byte, idx) => buffer[idx] === byte),
  );
}

/**
 * Throw BadRequestException if the buffer's first bytes don't match any of the
 * expected magic signatures. Use this AFTER multer has stored the upload, just
 * before processing the buffer (unzip, parse PDF, hand off to MinIO, etc.).
 *
 * Example:
 *   validateMagicBytes(file.buffer, ['zip']);   // restore endpoint
 *   validateMagicBytes(file.buffer, ['pdf', 'png', 'jpeg']);  // floor plan upload
 */
export function validateMagicBytes(buffer: Buffer, allowedKinds: MagicKind[]): void {
  if (!buffer || buffer.length < 4) {
    throw new BadRequestException(
      'Fichier invalide ou tronqué (impossible de vérifier la signature).',
    );
  }
  const matched = allowedKinds.some((kind) => bufferMatchesMagic(buffer, kind));
  if (!matched) {
    throw new BadRequestException(
      `Le contenu du fichier ne correspond pas au type attendu (${allowedKinds.join('/')}). ` +
      `Possible tentative d'upload d'un fichier déguisé.`,
    );
  }
}

/**
 * Mapping mimetype → magic-byte kinds attendus. Couvre les types courants
 * uploadés par XCH. Un mimetype absent de cette table fait un no-op (les
 * formats text-based comme CSV/TXT n'ont pas de magic bytes fiables, et
 * certains formats Office legacy (D0 CF 11 E0) ne sont pas couverts par
 * notre helper inline — la validation tombe alors sur fileFilter mimetype +
 * extension uniquement).
 */
const MIMETYPE_TO_KINDS: Record<string, MagicKind[]> = {
  'application/pdf': ['pdf'],
  'image/png': ['png'],
  'image/jpeg': ['jpeg'],
  'image/jpg': ['jpeg'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'application/zip': ['zip'],
  'application/x-zip-compressed': ['zip'],
  // Office moderne (.docx/.xlsx/.pptx) = conteneur ZIP, donc PK\x03\x04
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['zip'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['zip'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['zip'],
};

/**
 * Variante de `validateMagicBytes` qui dérive les kinds attendus depuis le
 * mimetype HTTP. Pratique pour les routes "polymorphes" (asset attachment
 * accepte PDF, image, doc Office). Silencieux si le mimetype n'est pas mappé
 * (= laisse passer ; le fileFilter mimetype + extension a déjà fait son
 * travail en amont).
 */
export function validateMagicBytesForMimetype(buffer: Buffer, mimetype: string): void {
  const kinds = MIMETYPE_TO_KINDS[mimetype];
  if (!kinds) return;
  validateMagicBytes(buffer, kinds);
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
