import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_DELEGATION_GUARD } from './delegation.guard';
import { REQUIRED_RIGHT_KEY, RequiredRight } from '../decorators/require-right.decorator';

/**
 * S4 — PermissionGuard fail-closed matrix.
 *
 * Covered scenarios:
 *   - @Public           → true (no auth required)
 *   - no user           → false (JwtAuthGuard fallback)
 *   - no decorator      → false (FAIL-CLOSED)
 *   - @SkipDelegation only → true (auth-only)
 *   - @SkipDelegation + @RequireRead → true if authenticated
 *   - @SkipDelegation + @RequireWrite/Manage → only super-admin
 *   - normal route + @RequireXxx → super-admin bypass
 *   - normal route + @RequireXxx → localRole must satisfy
 */
describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let reflector: jest.Mocked<Reflector>;

  /**
   * Build an ExecutionContext mock that returns a request with the given user
   * + localRole. Only the bits the guard actually reads are stubbed.
   */
  const makeContext = (
    user: { id?: string; email?: string; isSuperAdmin?: boolean } | null,
    localRole?: string,
  ): ExecutionContext => {
    const request = {
      user,
      localRole,
      method: 'GET',
      url: '/test',
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => () => undefined,
      getClass: () => class TestClass {},
    } as unknown as ExecutionContext;
  };

  /**
   * Configure the Reflector mock to return the given decorator metadata. Each
   * call to `getAllAndOverride` is keyed by the metadata key the guard reads.
   */
  const setMetadata = (opts: {
    isPublic?: boolean;
    skipDelegation?: boolean;
    requiredRight?: RequiredRight;
  }) => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return opts.isPublic ?? false;
      if (key === SKIP_DELEGATION_GUARD) return opts.skipDelegation ?? false;
      if (key === REQUIRED_RIGHT_KEY) return opts.requiredRight ?? undefined;
      return undefined;
    });
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get(PermissionGuard);
    reflector = module.get(Reflector);
  });

  it('allows @Public routes regardless of auth', () => {
    setMetadata({ isPublic: true });
    expect(guard.canActivate(makeContext(null))).toBe(true);
  });

  it('denies when there is no authenticated user (and not public)', () => {
    setMetadata({ requiredRight: 'READ' });
    expect(guard.canActivate(makeContext(null))).toBe(false);
  });

  it('FAIL-CLOSED: denies a non-public, non-skip route with no decorator', () => {
    setMetadata({});
    expect(
      guard.canActivate(makeContext({ id: 'u1', email: 'a@b.fr' })),
    ).toBe(false);
  });

  describe('@SkipDelegation', () => {
    it('allows authenticated user when no required right is set', () => {
      setMetadata({ skipDelegation: true });
      expect(
        guard.canActivate(makeContext({ id: 'u1', email: 'a@b.fr' })),
      ).toBe(true);
    });

    it('allows any authenticated user with @RequireRead', () => {
      setMetadata({ skipDelegation: true, requiredRight: 'READ' });
      expect(
        guard.canActivate(makeContext({ id: 'u1', email: 'a@b.fr' })),
      ).toBe(true);
    });

    it('allows super-admin with @RequireWrite', () => {
      setMetadata({ skipDelegation: true, requiredRight: 'WRITE' });
      expect(
        guard.canActivate(
          makeContext({ id: 'u1', email: 'a@b.fr', isSuperAdmin: true }),
        ),
      ).toBe(true);
    });

    it('allows super-admin with @RequireManage', () => {
      setMetadata({ skipDelegation: true, requiredRight: 'MANAGE' });
      expect(
        guard.canActivate(
          makeContext({ id: 'u1', email: 'a@b.fr', isSuperAdmin: true }),
        ),
      ).toBe(true);
    });

    it('denies non-super-admin with @RequireWrite', () => {
      setMetadata({ skipDelegation: true, requiredRight: 'WRITE' });
      expect(
        guard.canActivate(makeContext({ id: 'u1', email: 'a@b.fr' })),
      ).toBe(false);
    });

    it('denies non-super-admin with @RequireManage', () => {
      setMetadata({ skipDelegation: true, requiredRight: 'MANAGE' });
      expect(
        guard.canActivate(makeContext({ id: 'u1', email: 'a@b.fr' })),
      ).toBe(false);
    });
  });

  describe('Normal routes (delegation context)', () => {
    it('super-admin bypasses any required right (no localRole needed)', () => {
      setMetadata({ requiredRight: 'MANAGE' });
      expect(
        guard.canActivate(
          makeContext({ id: 'u1', email: 'a@b.fr', isSuperAdmin: true }),
        ),
      ).toBe(true);
    });

    it('denies when no localRole (no X-Delegation-Id header)', () => {
      setMetadata({ requiredRight: 'READ' });
      expect(
        guard.canActivate(makeContext({ id: 'u1', email: 'a@b.fr' })),
      ).toBe(false);
    });

    it('@RequireRead: READ localRole satisfies', () => {
      setMetadata({ requiredRight: 'READ' });
      expect(
        guard.canActivate(makeContext({ id: 'u1', email: 'a@b.fr' }, 'READ')),
      ).toBe(true);
    });

    it('@RequireWrite: READ localRole denied', () => {
      setMetadata({ requiredRight: 'WRITE' });
      expect(
        guard.canActivate(makeContext({ id: 'u1', email: 'a@b.fr' }, 'READ')),
      ).toBe(false);
    });

    it('@RequireWrite: WRITE localRole satisfies', () => {
      setMetadata({ requiredRight: 'WRITE' });
      expect(
        guard.canActivate(makeContext({ id: 'u1', email: 'a@b.fr' }, 'WRITE')),
      ).toBe(true);
    });

    it('@RequireWrite: MANAGE localRole satisfies (hierarchy)', () => {
      setMetadata({ requiredRight: 'WRITE' });
      expect(
        guard.canActivate(
          makeContext({ id: 'u1', email: 'a@b.fr' }, 'MANAGE'),
        ),
      ).toBe(true);
    });

    it('@RequireManage: WRITE localRole denied', () => {
      setMetadata({ requiredRight: 'MANAGE' });
      expect(
        guard.canActivate(makeContext({ id: 'u1', email: 'a@b.fr' }, 'WRITE')),
      ).toBe(false);
    });

    it('@RequireManage: MANAGE localRole satisfies', () => {
      setMetadata({ requiredRight: 'MANAGE' });
      expect(
        guard.canActivate(
          makeContext({ id: 'u1', email: 'a@b.fr' }, 'MANAGE'),
        ),
      ).toBe(true);
    });

    it('rejects unknown localRole values (rank=0)', () => {
      setMetadata({ requiredRight: 'READ' });
      expect(
        guard.canActivate(
          makeContext({ id: 'u1', email: 'a@b.fr' }, 'GUEST'),
        ),
      ).toBe(false);
    });
  });
});
