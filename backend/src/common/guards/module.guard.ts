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
 * Reads from Tenant.config.modules[moduleName].
 *
 * If no module metadata is set, the guard passes (no module restriction).
 * If config is null/undefined or modules key is missing, ALL modules are considered enabled (default).
 */
@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check for @RequireModule() on handler or class
    const requiredModule = this.reflector.getAllAndOverride<string>(
      REQUIRED_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No module requirement → allow
    if (!requiredModule) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('No tenant context');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { config: true },
    });

    if (!tenant) {
      throw new ForbiddenException('Tenant not found');
    }

    // If config is null or modules not set → all modules enabled by default
    const config = tenant.config as Record<string, any> | null;
    if (!config || !config.modules) {
      return true;
    }

    const modules = config.modules as Record<string, boolean>;

    // If the specific module key is not present → enabled by default
    if (modules[requiredModule] === undefined) {
      return true;
    }

    if (modules[requiredModule] === false) {
      throw new ForbiddenException(
        `Module "${requiredModule}" is disabled for your organization`,
      );
    }

    return true;
  }
}
