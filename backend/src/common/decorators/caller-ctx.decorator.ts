import { createParamDecorator, ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import { CallerCtx } from '../types/caller-ctx.interface';

/**
 * ADR-021 — `@CallerCtx()` builds a CallerCtx from the request set up
 * by JwtAuthGuard + DelegationGuard. To be used on every controller
 * handler that calls a service method needing scope filtering.
 *
 * Usage:
 *   @Get(':id')
 *   findOne(@Param('id') id: string, @CallerCtx() ctx: CallerCtx) {
 *     return this.svc.findOne(id, ctx);
 *   }
 *
 * Throws if no `req.user` is attached — the decorator is meant for
 * authenticated routes only. Use `SYSTEM_CTX(reason, tenantId)` for
 * cron / BullMQ / seed call sites instead.
 */
// Renamed `CallerCtxParam` (vs `CallerCtx`) to avoid TS2395 merged-
// declaration conflict with the imported `CallerCtx` interface.
// Controllers import { CallerCtxParam } @CallerCtxParam() ctx: CallerCtx.
export const CallerCtxParam = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CallerCtx => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    if (!user || !user.tenantId) {
      throw new InternalServerErrorException(
        'CallerCtx used on an unauthenticated route — add JwtAuthGuard or use SYSTEM_CTX',
      );
    }
    return {
      userId: user.userId ?? user.id,
      isSuperAdmin: !!user.isSuperAdmin,
      tenantId: user.tenantId,
      activeDelegationId: request.delegationId ?? null,
      activeRight: (request.localRole as CallerCtx['activeRight']) ?? null,
    };
  },
);
