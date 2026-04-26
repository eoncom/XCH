import { BadRequestException } from '@nestjs/common';
import {
  bufferMatchesMagic,
  validateMagicBytes,
  sanitizeForExcel,
} from './upload-security';

/**
 * S1 hardening 2026-04-26 — tests for magic-bytes helpers.
 * Defense in depth against an attacker uploading a renamed executable
 * with a faked mimetype.
 */
describe('upload-security — magic bytes', () => {
  describe('bufferMatchesMagic', () => {
    it('detects ZIP via PK\\x03\\x04 signature', () => {
      const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
      expect(bufferMatchesMagic(zip, 'zip')).toBe(true);
    });

    it('detects ZIP via PK\\x05\\x06 (empty archive) signature', () => {
      const emptyZip = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
      expect(bufferMatchesMagic(emptyZip, 'zip')).toBe(true);
    });

    it('detects PDF via %PDF signature', () => {
      const pdf = Buffer.from('%PDF-1.4\n', 'utf8');
      expect(bufferMatchesMagic(pdf, 'pdf')).toBe(true);
    });

    it('detects PNG via 8-byte signature', () => {
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
      expect(bufferMatchesMagic(png, 'png')).toBe(true);
    });

    it('detects JPEG via FF D8 FF signature', () => {
      const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      expect(bufferMatchesMagic(jpeg, 'jpeg')).toBe(true);
    });

    it('rejects an EXE buffer pretending to be ZIP', () => {
      // Windows PE/EXE starts with MZ (4d 5a)
      const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
      expect(bufferMatchesMagic(exe, 'zip')).toBe(false);
      expect(bufferMatchesMagic(exe, 'pdf')).toBe(false);
      expect(bufferMatchesMagic(exe, 'png')).toBe(false);
    });

    it('rejects a script buffer pretending to be PDF', () => {
      const script = Buffer.from('#!/bin/sh\nrm -rf /\n', 'utf8');
      expect(bufferMatchesMagic(script, 'pdf')).toBe(false);
    });
  });

  describe('validateMagicBytes', () => {
    it('passes silently when buffer matches expected kind', () => {
      const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
      expect(() => validateMagicBytes(zip, ['zip'])).not.toThrow();
    });

    it('passes when buffer matches one of several allowed kinds', () => {
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(() => validateMagicBytes(png, ['pdf', 'png', 'jpeg'])).not.toThrow();
    });

    it('throws BadRequestException when buffer matches none of the allowed kinds', () => {
      const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
      expect(() => validateMagicBytes(exe, ['zip', 'pdf'])).toThrow(BadRequestException);
    });

    it('throws BadRequestException on truncated/empty buffer', () => {
      expect(() => validateMagicBytes(Buffer.from([]), ['zip'])).toThrow(BadRequestException);
      expect(() => validateMagicBytes(Buffer.from([0x50]), ['zip'])).toThrow(BadRequestException);
    });

    it('error message lists allowed kinds and mentions deguised file risk', () => {
      const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
      try {
        validateMagicBytes(exe, ['zip']);
        fail('should have thrown');
      } catch (e: any) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.message).toContain('zip');
        expect(e.message).toContain('déguisé');
      }
    });
  });

  describe('sanitizeForExcel (regression — already in helper)', () => {
    it('escapes formula-prefix chars', () => {
      expect(sanitizeForExcel('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
      expect(sanitizeForExcel('+1+1')).toBe("'+1+1");
      expect(sanitizeForExcel('-1')).toBe("'-1");
      expect(sanitizeForExcel('@cmd')).toBe("'@cmd");
    });

    it('passes safe values through', () => {
      expect(sanitizeForExcel('hello')).toBe('hello');
      expect(sanitizeForExcel(42)).toBe('42');
    });

    it('handles null and undefined', () => {
      expect(sanitizeForExcel(null)).toBe('');
      expect(sanitizeForExcel(undefined)).toBe('');
    });
  });
});
