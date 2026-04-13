import { Injectable, CanActivate, ExecutionContext, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';

export const SKIP_DELEGATION_GUARD = 'skipDelegationGuard';

/**
 * DelegationGuard (R10)
 *
 * Extracts X-Delegation-Id header and validates that the user
 * has a UserDelegation for this delegation.
 *
 * Attaches { delegationId, localRole } to request.
 *
 * Super admin (isSuperAdmin=true) bypasses UserDelegation check.
 * Routes marked with @SkipDelegation() bypass entirely (global routes).
 */
@Injectable()
export class DelegationGuard implements CanActivate {
  constructor(
    private prisma: PrismaClient,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked to skip delegation check (global routes)
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_DELEGATION_GUARD, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // No user = public endpoint (auth not required) → skip delegation check
    if (!user) return true;

    const delegationId = request.headers['x-delegation-id'] as string;

    // No header = no delegation context → endpoints that need it will fail in PermissionGuard
    if (!delegationId) {
      return true;
    }

    // Verify delegation exists and belongs to user's tenant
    const delegation = await this.prisma.delegation.findFirst({
      where: { id: delegationId, tenantId: user.tenantId },
    });

    if (!delegation) {
      throw new ForbiddenException('Invalid delegation');
    }

    // Super admin bypass — access any delegation
    if (user.isSuperAdmin) {
      request.delegationId = delegationId;
      request.localRole = 'MANAGE'; // Super admin acts as MANAGE in any delegation
      return true;
    }

    // Check UserDelegation
    const userDelegation = await this.prisma.userDelegation.findUnique({
      where: {
        userId_delegationId: {
          userId: user.id,
          delegationId,
        },
      },
    });

    if (!userDelegation) {
      throw new ForbiddenException('No access to this delegation');
    }

    // Attach delegation context to request
    request.delegationId = delegationId;
    request.localRole = userDelegation.right;

    return true;
  }
}
