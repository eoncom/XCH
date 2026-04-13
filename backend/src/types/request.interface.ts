import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;        // User ID (alias for userId)
  userId: string;    // User ID (full property name)
  tenantId: string;
  email: string;
  isSuperAdmin: boolean;
  totpEnabled?: boolean;
}

export interface AuthRequest extends Request {
  user: AuthenticatedUser;
  /** Set by DelegationGuard — active delegation ID from X-Delegation-Id header */
  delegationId?: string;
  /** Set by DelegationGuard — local role within the active delegation (from UserDelegation) */
  localRole?: string;
}
