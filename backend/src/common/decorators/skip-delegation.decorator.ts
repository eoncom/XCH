import { SetMetadata } from '@nestjs/common';
import { SKIP_DELEGATION_GUARD } from '../guards/delegation.guard';

/**
 * Marks a route or controller to skip DelegationGuard.
 * Use on global routes protected by @SuperAdmin() instead.
 */
export const SkipDelegation = () => SetMetadata(SKIP_DELEGATION_GUARD, true);
