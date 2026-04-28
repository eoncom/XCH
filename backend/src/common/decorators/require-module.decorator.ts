import { SetMetadata } from '@nestjs/common';

export const REQUIRED_MODULE_KEY = 'requiredModule';

/**
 * Decorator to mark a controller or endpoint as requiring a specific module to be enabled.
 * Used with ModuleGuard to check `tenant_feature_flags` table (ADR-018,
 * ex-tenant.config.modules JSON map).
 *
 * @example
 * @RequireModule('floor_plans')
 * @Controller('floor-plans')
 * export class FloorPlansController {}
 */
export const RequireModule = (moduleName: string) =>
  SetMetadata(REQUIRED_MODULE_KEY, moduleName);
