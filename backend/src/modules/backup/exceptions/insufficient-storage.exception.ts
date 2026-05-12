import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * HTTP 507 Insufficient Storage — raised when the worker tmpfs does not
 * have enough free space to safely build the backup archive.
 *
 * Used by `BackupService.checkDiskSpace` (pre-flight check at the start
 * of every backup job) and by `POST /backup/estimate` (response sets
 * `ok: false` instead of throwing, but the message is the same).
 *
 * The 1.2 × buffer + 512 MB margin is intentional : archiver may produce
 * an output slightly larger than the sum of inputs (zip overhead, JSON
 * pretty-print padding), and we want headroom for concurrent Prisma
 * working temp files.
 */
export class InsufficientStorageException extends HttpException {
  constructor(estimatedBytes: number, freeBytes: number) {
    super(
      {
        statusCode: HttpStatus.INSUFFICIENT_STORAGE,
        error: 'Insufficient Storage',
        message:
          `Backup would need ~${estimatedBytes} bytes plus 20% headroom, ` +
          `but only ${freeBytes} bytes are free on the worker tmpfs.`,
        estimatedBytes,
        freeBytes,
      },
      HttpStatus.INSUFFICIENT_STORAGE,
    );
  }
}
