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

    // Use localRole from DelegationGuard (R7: UserDelegation.role is source of truth)
    // Fallback to user.role for routes without DelegationGuard (e.g. global admin routes)
    const role = request.localRole || user.role;

    const allowed = await this.enforcer.enforce(
      role,
      resource,
      action,
      user.tenantId,
    );

    return allowed;
  }
}
