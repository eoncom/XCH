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

    const allowed = await this.enforcer.enforce(
      user.role,
      resource,
      action,
      user.tenantId,
    );

    return allowed;
  }
}
