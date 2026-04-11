import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Enforcer } from 'casbin';

@Injectable()
export class CasbinGuard implements CanActivate {
  constructor(
    @Inject('CASBIN_ENFORCER') private enforcer: Enforcer,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    const resource = this.reflector.get<string>('resource', context.getHandler());
    const action = this.reflector.get<string>('action', context.getHandler());

    if (!resource || !action) {
      return true;
    }

    // Super admin bypasses Casbin checks entirely
    if (user.isSuperAdmin) {
      return true;
    }

    // localRole = UserDelegation.role set by DelegationGuard
    // If absent, DelegationGuard hasn't run (missing X-Delegation-Id) → deny
    const role = request.localRole;
    if (!role) {
      return false;
    }

    const allowed = await this.enforcer.enforce(
      role,
      resource,
      action,
      user.tenantId,
    );

    return allowed;
  }
}
