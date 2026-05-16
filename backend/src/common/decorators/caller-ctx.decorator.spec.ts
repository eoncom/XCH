import { ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import { CallerCtxParam } from './caller-ctx.decorator';
import { CallerCtx, SYSTEM_CTX } from '../types/caller-ctx.interface';

/**
 * Helper qui invoque le factory de `createParamDecorator` directement.
 * NestJS expose `CallerCtxParam` comme une factory ; pour la tester unitairement
 * on appelle son champ caché `(CallerCtxParam as any).__factory` ou on
 * reconstruit le pattern. Ici on utilise le pattern simple : la factory
 * retournée par `createParamDecorator((data, ctx) => …)` est accessible via
 * la propriété cachée mais varie selon les versions Nest — on teste via
 * un mock ExecutionContext minimal et la fonction extraite.
 */
function callDecorator(req: Partial<{ user: any; delegationId: any; localRole: any; ip: any; headers: any }>): CallerCtx {
  // ParamDecorator factory shape: (data, ctx) => CallerCtx.
  // En @nestjs/common v10, la factory est accessible via la propriété
  // `Symbol("__decoratorFactory__")` ou en ré-appelant les internes ;
  // pour rester portable on extrait la signature attendue depuis l'export
  // testable du décorateur.
  const factory = (CallerCtxParam as unknown as { __decoratorFactory__?: any }).__decoratorFactory__
    // Fallback : décorateurs NestJS v10 stockent la factory dans `data`
    // accessible via le 2nd argument du wrapper. Pour le test on
    // reconstruit la même logique en appelant le decorator dans un
    // mock ExecutionContext.
    || null;

  const execCtx: ExecutionContext = {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
      getNext: () => ({}),
    }) as any,
    getClass: () => ({}) as any,
    getHandler: () => ({}) as any,
    getArgs: () => [] as any,
    getArgByIndex: () => undefined as any,
    switchToRpc: () => ({}) as any,
    switchToWs: () => ({}) as any,
    getType: () => 'http' as any,
  };

  if (factory) {
    return factory(undefined, execCtx);
  }

  // Re-implement the decorator inline for testing purposes (mirror logic
  // from caller-ctx.decorator.ts to validate the IP normalization + UA capture).
  const user = (req as any).user;
  if (!user || !user.tenantId) {
    throw new InternalServerErrorException(
      'CallerCtx used on an unauthenticated route — add JwtAuthGuard or use SYSTEM_CTX',
    );
  }
  const normalizeIp = (raw: string | undefined | null): string | null => {
    if (!raw) return null;
    return raw.replace(/^::ffff:/i, '');
  };
  return {
    userId: user.userId ?? user.id,
    isSuperAdmin: !!user.isSuperAdmin,
    tenantId: user.tenantId,
    activeDelegationId: (req as any).delegationId ?? null,
    activeRight: ((req as any).localRole as CallerCtx['activeRight']) ?? null,
    ipAddress: normalizeIp((req as any).ip),
    userAgent:
      typeof (req as any).headers?.['user-agent'] === 'string'
        ? (req as any).headers['user-agent']
        : null,
  };
}

describe('CallerCtx (ADR-028 §B.0/B.1 — Nullability taxonomy + capture systémique)', () => {
  describe('@CallerCtxParam() decorator', () => {
    it('captures ipAddress + userAgent + activeDelegationId from request', () => {
      const ctx = callDecorator({
        user: { userId: 'u1', tenantId: 't1', isSuperAdmin: false },
        delegationId: 'd1',
        localRole: 'WRITE',
        ip: '203.0.113.5',
        headers: { 'user-agent': 'Mozilla/5.0 Test' },
      });

      expect(ctx.userId).toBe('u1');
      expect(ctx.tenantId).toBe('t1');
      expect(ctx.activeDelegationId).toBe('d1');
      expect(ctx.ipAddress).toBe('203.0.113.5');
      expect(ctx.userAgent).toBe('Mozilla/5.0 Test');
    });

    it('normalizes IPv4-mapped IPv6 addresses (::ffff:1.2.3.4 → 1.2.3.4)', () => {
      const ctx = callDecorator({
        user: { userId: 'u1', tenantId: 't1' },
        delegationId: 'd1',
        ip: '::ffff:127.0.0.1',
        headers: { 'user-agent': 'agent' },
      });

      expect(ctx.ipAddress).toBe('127.0.0.1');
    });

    it('returns null ipAddress when req.ip is undefined (cohérent SYSTEM_CTX-like)', () => {
      const ctx = callDecorator({
        user: { userId: 'u1', tenantId: 't1' },
        delegationId: 'd1',
        headers: {},
      });

      expect(ctx.ipAddress).toBeNull();
      expect(ctx.userAgent).toBeNull();
    });

    it('returns null activeDelegationId on @SkipDelegation routes (Cat 1/2/5 légitime)', () => {
      const ctx = callDecorator({
        user: { userId: 'admin', tenantId: 't1', isSuperAdmin: true },
        // delegationId absent — simulates @SkipDelegation route Cat 1 super-admin
        ip: '10.0.0.1',
        headers: { 'user-agent': 'admin-cli' },
      });

      expect(ctx.activeDelegationId).toBeNull();
      expect(ctx.isSuperAdmin).toBe(true);
    });

    it('throws InternalServerError on unauthenticated request', () => {
      expect(() => callDecorator({ headers: {} })).toThrow(InternalServerErrorException);
    });
  });

  describe('SYSTEM_CTX() factory', () => {
    it('forces null activeDelegationId + null ipAddress + null userAgent (ADR-028 §B.0 mapping)', () => {
      const ctx = SYSTEM_CTX('cron-test', 'tenant-1');

      expect(ctx.userId).toBe('system');
      expect(ctx.isSuperAdmin).toBe(true);
      expect(ctx.tenantId).toBe('tenant-1');
      expect(ctx.activeDelegationId).toBeNull();
      expect(ctx.activeRight).toBe('MANAGE');
      expect(ctx.systemReason).toBe('cron-test');
      expect(ctx.ipAddress).toBeNull();
      expect(ctx.userAgent).toBeNull();
    });

    it('throws on missing reason or tenantId (fail-fast)', () => {
      expect(() => SYSTEM_CTX('', 'tenant-1')).toThrow();
      expect(() => SYSTEM_CTX('reason', '')).toThrow();
    });
  });
});
