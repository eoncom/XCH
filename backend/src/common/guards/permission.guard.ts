import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_DELEGATION_GUARD } from './delegation.guard';
import { REQUIRED_RIGHT_KEY, RequiredRight } from '../decorators/require-right.decorator';
import { rightSatisfies } from '../services/permission.service';

/**
 * PermissionGuard — replaces CasbinGuard.
 *
 * Registered as APP_GUARD after JwtAuthGuard and DelegationGuard.
 *
 * Checks that the user's localRole (set by DelegationGuard from UserDelegation.right)
 * satisfies the minimum right declared by @RequireManage/@RequireWrite/@RequireRead.
 *
 * Fail-closed: if an endpoint has no permission decorator and is not @Public/@SkipDelegation,
 * access is DENIED and a warning is logged. This prevents accidental exposure.
 *
 * Note: This guard handles delegation-level authorization only.
 * Site-level + resource-level checks (AccessOverride) are handled by
 * PermissionService.resolve() in the services layer.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip public routes (no auth required)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Skip routes that bypass delegation (global routes like /auth/me, /tenants/current)
    const skipDelegation = this.reflector.getAllAndOverride<boolean>(SKIP_DELEGATION_GUARD, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // No user = unauthenticated (should have been caught by JwtAuthGuard)
    if (!user) return false;

    // Read the required right from decorator metadata
    const requiredRight = this.reflector.getAllAndOverride<RequiredRight>(REQUIRED_RIGHT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If @SkipDelegation and no required right → allow (e.g. @SkipDelegation + auth-only)
    // If @SkipDelegation + @RequireManage → check isSuperAdmin (no delegation context)
    if (skipDelegation) {
      if (!requiredRight) return true;

      // With @SkipDelegation, only super admin can satisfy MANAGE/WRITE
      // For READ, any authenticated user passes
      if (requiredRight === 'READ') return true;
      if (user.isSuperAdmin) return true;

      this.logger.warn(
        `Access denied: ${user.email} needs ${requiredRight} on SkipDelegation route ${request.method} ${request.url}`,
      );
      return false;
    }

    // FAIL-CLOSED: no decorator on a non-public, non-skip route → deny
    if (!requiredRight) {
      // Check for legacy @Resource/@Action decorators (transitional support)
      const legacyResource = this.reflector.get<string>('resource', context.getHandler());
      const legacyAction = this.reflector.get<string>('action', context.getHandler());

      if (legacyResource && legacyAction) {
        // Transitional: map legacy action to right
        return this.handleLegacy(request, legacyAction);
      }

      this.logger.warn(
        `FAIL-CLOSED: No permission decorator on ${request.method} ${request.url} — access denied`,
      );
      return false;
    }

    // Super admin bypasses delegation checks
    if (user.isSuperAdmin) return true;

    // localRole is set by DelegationGuard from UserDelegation.right
    const localRole = request.localRole as string | undefined;

    if (!localRole) {
      // No delegation context → no localRole → deny
      // (Missing X-Delegation-Id header on a route that requires it)
      this.logger.warn(
        `Access denied: no delegation context for ${user.email} on ${request.method} ${request.url}`,
      );
      return false;
    }

    // Check: does localRole satisfy requiredRight?
    return rightSatisfies(localRole, requiredRight);
  }

  /**
   * Transitional handler for legacy @Resource/@Action decorators.
   * Maps old action verbs to new rights during migration (Lot 3).
   * Will be removed after all controllers are migrated.
   */
  private handleLegacy(request: any, action: string): boolean {
    const user = request.user;
    if (!user) return false;
    if (user.isSuperAdmin) return true;

    const localRole = request.localRole as string | undefined;
    if (!localRole) return false;

    // Map legacy actions to required rights
    let requiredRight: RequiredRight;
    switch (action) {
      case 'create':
      case 'update':
      case 'delete':
        requiredRight = 'WRITE';
        break;
      case 'read':
        requiredRight = 'READ';
        break;
      case 'manage':
        requiredRight = 'MANAGE';
        break;
      default:
        requiredRight = 'WRITE';
    }

    return rightSatisfies(localRole, requiredRight);
  }
}
