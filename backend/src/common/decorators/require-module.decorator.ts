import { SetMetadata } from '@nestjs/common';

export const REQUIRED_MODULE_KEY = 'requiredModule';

/**
 * Decorator to mark a controller or endpoint as requiring a specific module to be enabled.
 * Used with ModuleGuard to check tenant.config.modules[moduleName].
 *
 * @example
 * @RequireModule('floor_plans')
 * @Controller('floor-plans')
 * export class FloorPlansController {}
 */
export const RequireModule = (moduleName: string) =>
  SetMetadata(REQUIRED_MODULE_KEY, moduleName);
