import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { REQUIRED_MODULE_KEY } from '../decorators/require-module.decorator';

/**
 * Guard that checks if a required module is enabled for the current tenant.
 * Reads from the typed `tenant_feature_flags` table (ADR-018, ex-Tenant.config.modules).
 *
 * If no @RequireModule metadata is set, the guard passes (no module restriction).
 * If no row exists for the (tenant, module) pair → enabled by default
 * (matches the legacy "absent key = on" semantic).
 */
@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModule = this.reflector.getAllAndOverride<string>(
      REQUIRED_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredModule) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('No tenant context');
    }

    const flag = await this.prisma.tenantFeatureFlag.findUnique({
      where: { tenantId_name: { tenantId, name: requiredModule } },
      select: { enabled: true },
    });

    // Absent flag → enabled by default. Explicit false → forbidden.
    if (flag && flag.enabled === false) {
      throw new ForbiddenException(
        `Module "${requiredModule}" is disabled for your organization`,
      );
    }

    return true;
  }
}
