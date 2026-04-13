import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used by PermissionGuard to read the minimum required right.
 */
export const REQUIRED_RIGHT_KEY = 'requiredRight';

/**
 * Minimum delegation right levels for PermissionGuard.
 * MANAGE > WRITE > READ
 */
export type RequiredRight = 'MANAGE' | 'WRITE' | 'READ';

/**
 * Requires MANAGE right on the active delegation.
 * Use for: user management, delegation settings, site CRUD.
 */
export const RequireManage = () => SetMetadata(REQUIRED_RIGHT_KEY, 'MANAGE' as RequiredRight);

/**
 * Requires WRITE right on the active delegation.
 * Use for: create/update/delete assets, tasks, racks, plans, contacts, expenses.
 */
export const RequireWrite = () => SetMetadata(REQUIRED_RIGHT_KEY, 'WRITE' as RequiredRight);

/**
 * Requires READ right on the active delegation.
 * Use for: list/view any resource.
 */
export const RequireRead = () => SetMetadata(REQUIRED_RIGHT_KEY, 'READ' as RequiredRight);
