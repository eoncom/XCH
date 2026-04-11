import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route or controller as public (no JWT auth required).
 * Use on endpoints like login, register, setup, etc.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
