import { instanceToPlain } from 'class-transformer';
import { toResponse } from '../../common/utils/to-response.util';
import { AuthUserRefResponseDto } from './dto/auth-user-ref.response.dto';
import { AuthUserResponseDto } from './dto/auth-user.response.dto';
import { AuthProfileResponseDto } from './dto/auth-profile.response.dto';
import { LoginResponseDto } from './dto/login.response.dto';
import { SessionResponseDto } from './dto/session.response.dto';
import { TotpSetupResponseDto } from './dto/totp-setup.response.dto';
import { TotpVerifySetupResponseDto } from './dto/totp-verify-setup.response.dto';
import { MyPermissionsResponseDto } from './dto/auth-permissions.response.dto';
import { SsoConfigResponseDto } from './dto/sso-config.response.dto';
import { InviteResponseDto } from './dto/invite.response.dto';
import {
  AuthSuccessResultResponseDto,
  TotpDisabledResultResponseDto,
  AuthMessageResultResponseDto,
} from './dto/auth-action-result.response.dto';

/**
 * S9 — Auth response DTO discipline. The auth module is by far the most
 * sensitive surface: any leak of passwordHash, totpSecret, totpBackupCodes,
 * inviteToken, resetToken, failedLoginAttempts, lockedUntil, externalId is a
 * security incident. This spec verifies inclusion + anti-leak across all
 * auth response DTOs (assertions on shape AND runtime smoke through
 * instanceToPlain → JSON.stringify regex matchers).
 */

// Realistic Prisma user shape with EVERY sensitive column populated.
// Used as input to multiple DTOs to verify none of them leak.
const PRISMA_USER_WITH_SECRETS = {
  id: 'usr-1',
  tenantId: 'tnt-1',
  email: 'admin@demo.fr',
  name: 'Admin Demo',
  phone: '+33 6 00 00 00 00',
  avatarUrl: null,
  isSuperAdmin: true,
  active: true,
  externalId: 'oidc-sub-abc123', // OIDC link — must NOT leak
  authProvider: 'local',
  totpEnabled: true,
  lastLoginAt: new Date('2026-05-05T10:00:00Z'),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-04-15T00:00:00Z'),
  // CRITICAL — sensitive credentials, must NOT roundtrip to the wire.
  passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyzABCDEF',
  totpSecret: 'JBSWY3DPEHPK3PXP', // example base32 TOTP
  totpBackupCodes: ['hashed-code-1', 'hashed-code-2', 'hashed-code-3'],
  inviteToken: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
  inviteTokenExpiry: new Date('2026-05-08T00:00:00Z'),
  resetToken: 'f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5',
  resetTokenExpiry: new Date('2026-05-08T00:00:00Z'),
  failedLoginAttempts: 3,
  lockedUntil: null,
  // Tenant ref (legitimate)
  tenant: { id: 'tnt-1', name: 'Demo', subdomain: 'demo', _hidden: 'leak' },
};

const SECRET_REGEX_BUNDLE = [
  /passwordHash/,
  /\$2[aby]\$/,                     // bcrypt prefix
  /totpSecret/,
  /JBSWY3DPEHPK3PXP/,               // example TOTP base32 value
  /totpBackupCodes/,
  /inviteToken/,                    // matches both field name AND legacy values
  /resetToken/,
  /a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6/, // sample invite token value
  /f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5/, // sample reset token value
  /failedLoginAttempts/,
  /lockedUntil/,
  /externalId/,
  /oidc-sub-abc123/,
];

function expectNoSecretsInWire(dto: unknown) {
  const wireJson = JSON.stringify(instanceToPlain(dto));
  for (const re of SECRET_REGEX_BUNDLE) {
    expect(wireJson).not.toMatch(re);
  }
}

/**
 * Returns the actual wire shape an HTTP client will receive — `JSON.parse`
 * after `JSON.stringify` drops the `undefined` properties that
 * `instanceToPlain` leaves on the in-memory plain object.
 */
function wireShape(dto: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(instanceToPlain(dto))) as Record<string, unknown>;
}

describe('Auth response DTO shapes — sensitive credentials must NEVER leak', () => {
  describe('AuthUserRefResponseDto (compact user embedded in login/session/2fa)', () => {
    const dto = toResponse(AuthUserRefResponseDto, PRISMA_USER_WITH_SECRETS);

    it('exposes the legitimate compact identity fields', () => {
      expect(dto).toHaveProperty('id', 'usr-1');
      expect(dto).toHaveProperty('email', 'admin@demo.fr');
      expect(dto).toHaveProperty('name', 'Admin Demo');
      expect(dto).toHaveProperty('tenantId', 'tnt-1');
      expect(dto).toHaveProperty('totpEnabled', true);
      expect(dto).toHaveProperty('isSuperAdmin', true);
    });

    it('embeds the typed tenant ref with whitelist (no _hidden)', () => {
      expect(dto.tenant).toEqual({ id: 'tnt-1', name: 'Demo', subdomain: 'demo' });
      expect(dto.tenant).not.toHaveProperty('_hidden');
    });

    it('does NOT expose any sensitive credential field', () => {
      expect(dto).not.toHaveProperty('passwordHash');
      expect(dto).not.toHaveProperty('totpSecret');
      expect(dto).not.toHaveProperty('totpBackupCodes');
      expect(dto).not.toHaveProperty('inviteToken');
      expect(dto).not.toHaveProperty('resetToken');
      expect(dto).not.toHaveProperty('failedLoginAttempts');
      expect(dto).not.toHaveProperty('lockedUntil');
      expect(dto).not.toHaveProperty('externalId');
      expect(dto).not.toHaveProperty('phone');     // not in compact ref
      expect(dto).not.toHaveProperty('avatarUrl'); // not in compact ref
    });

    it('runtime serialization is leak-free', () => {
      expectNoSecretsInWire(dto);
    });

    it('handles null tenant gracefully', () => {
      const dtoNoTenant = toResponse(AuthUserRefResponseDto, {
        ...PRISMA_USER_WITH_SECRETS,
        tenant: null,
      });
      expect(dtoNoTenant.tenant).toBeNull();
      expectNoSecretsInWire(dtoNoTenant);
    });
  });

  describe('AuthUserResponseDto (full safe user — register / invite return)', () => {
    const dto = toResponse(AuthUserResponseDto, PRISMA_USER_WITH_SECRETS);

    it('exposes legitimate identity & profile fields', () => {
      expect(dto).toHaveProperty('id', 'usr-1');
      expect(dto).toHaveProperty('email', 'admin@demo.fr');
      expect(dto).toHaveProperty('name', 'Admin Demo');
      expect(dto).toHaveProperty('phone', '+33 6 00 00 00 00');
      expect(dto).toHaveProperty('isSuperAdmin', true);
      expect(dto).toHaveProperty('active', true);
      expect(dto).toHaveProperty('authProvider', 'local');
      expect(dto).toHaveProperty('totpEnabled', true);
      expect(dto.tenant).toEqual({ id: 'tnt-1', name: 'Demo', subdomain: 'demo' });
    });

    it('does NOT expose any sensitive credential field', () => {
      expect(dto).not.toHaveProperty('passwordHash');
      expect(dto).not.toHaveProperty('totpSecret');
      expect(dto).not.toHaveProperty('totpBackupCodes');
      expect(dto).not.toHaveProperty('inviteToken');
      expect(dto).not.toHaveProperty('resetToken');
      expect(dto).not.toHaveProperty('failedLoginAttempts');
      expect(dto).not.toHaveProperty('lockedUntil');
      expect(dto).not.toHaveProperty('externalId');
    });

    it('runtime serialization is leak-free', () => {
      expectNoSecretsInWire(dto);
    });
  });

  describe('AuthProfileResponseDto (GET /profile — JWT-payload-derived shape)', () => {
    // Realistic JWT validate() output PLUS a contaminated extra prop to
    // verify whitelist drops it.
    const reqUser = {
      id: 'usr-1',
      userId: 'usr-1',
      email: 'admin@demo.fr',
      tenantId: 'tnt-1',
      isSuperAdmin: true,
      // Hypothetical contamination from a future bug (extra JWT claim).
      passwordHash: 'should-never-arrive-here',
      totpSecret: 'JBSWY3DPEHPK3PXP',
    };

    const dto = toResponse(AuthProfileResponseDto, reqUser);

    it('exposes the JWT-derived caller identity', () => {
      expect(dto).toHaveProperty('id', 'usr-1');
      expect(dto).toHaveProperty('userId', 'usr-1');
      expect(dto).toHaveProperty('email', 'admin@demo.fr');
      expect(dto).toHaveProperty('tenantId', 'tnt-1');
      expect(dto).toHaveProperty('isSuperAdmin', true);
    });

    it('does NOT expose contamination from accidental extra claims', () => {
      expect(dto).not.toHaveProperty('passwordHash');
      expect(dto).not.toHaveProperty('totpSecret');
      expectNoSecretsInWire(dto);
    });
  });

  describe('LoginResponseDto (3 wire shapes)', () => {
    it('shape 1 — { requires2FA, tempToken } (2FA gate)', () => {
      const dto = toResponse(LoginResponseDto, {
        requires2FA: true,
        tempToken: 'temp-jwt-5min',
      });
      expect(dto.requires2FA).toBe(true);
      expect(dto.tempToken).toBe('temp-jwt-5min');
      const wire = wireShape(dto);
      expect(wire).not.toHaveProperty('user');
      expect(wire).not.toHaveProperty('requires2FASetup');
    });

    it('shape 2 — { user, requires2FASetup } (tenant requires enrollment)', () => {
      const dto = toResponse(LoginResponseDto, {
        user: PRISMA_USER_WITH_SECRETS,
        requires2FASetup: true,
      });
      expect(dto.requires2FASetup).toBe(true);
      expect(dto.user).toBeDefined();
      expect(dto.user).toHaveProperty('email', 'admin@demo.fr');
      const wire = wireShape(dto);
      expect(wire).not.toHaveProperty('requires2FA');
      expect(wire).not.toHaveProperty('tempToken');
      expectNoSecretsInWire(dto);
    });

    it('shape 3 — { user } (vanilla success)', () => {
      const dto = toResponse(LoginResponseDto, {
        user: PRISMA_USER_WITH_SECRETS,
      });
      expect(dto.user).toBeDefined();
      expect(dto.user).toHaveProperty('email', 'admin@demo.fr');
      const wire = wireShape(dto);
      expect(wire).not.toHaveProperty('requires2FA');
      expect(wire).not.toHaveProperty('tempToken');
      expect(wire).not.toHaveProperty('requires2FASetup');
      expectNoSecretsInWire(dto);
    });

    it('embedded user (shape 2 + 3) does not leak any credential', () => {
      const dto = toResponse(LoginResponseDto, {
        user: PRISMA_USER_WITH_SECRETS,
      });
      expect(dto.user).not.toHaveProperty('passwordHash');
      expect(dto.user).not.toHaveProperty('totpSecret');
      expect(dto.user).not.toHaveProperty('totpBackupCodes');
      expect(dto.user).not.toHaveProperty('inviteToken');
      expect(dto.user).not.toHaveProperty('resetToken');
      expect(dto.user).not.toHaveProperty('externalId');
      expectNoSecretsInWire(dto);
    });

    /**
     * Defensive test for cross-shape contamination — a future bug (or
     * service refactor) could accidentally pass `{ requires2FA, tempToken,
     * user: somePrismaUser }`. The DTO can't enforce the discriminated-
     * union semantics, but the embedded `AuthUserRefResponseDto` strict
     * whitelist must still drop every credential. Result: the wire shape
     * is semantically wrong (mixes 2FA-gate fields with user payload) but
     * is NOT a security incident — no passwordHash/totpSecret/token leaks
     * to the network.
     */
    it('contamination defense — shape 1 + accidental user does not leak credentials', () => {
      const dto = toResponse(LoginResponseDto, {
        requires2FA: true,
        tempToken: 'temp-jwt-5min',
        user: PRISMA_USER_WITH_SECRETS, // accidental contamination
      });
      const wire = wireShape(dto);
      expect(wire.requires2FA).toBe(true);
      expect(wire.tempToken).toBe('temp-jwt-5min');
      // The contaminated user IS present in the wire (shape mixed) but
      // every credential field is whitelisted away by AuthUserRefResponseDto.
      expect(wire.user).toBeDefined();
      const user = wire.user as Record<string, unknown>;
      expect(user).not.toHaveProperty('passwordHash');
      expect(user).not.toHaveProperty('totpSecret');
      expect(user).not.toHaveProperty('totpBackupCodes');
      expect(user).not.toHaveProperty('inviteToken');
      expect(user).not.toHaveProperty('resetToken');
      expect(user).not.toHaveProperty('failedLoginAttempts');
      expect(user).not.toHaveProperty('lockedUntil');
      expect(user).not.toHaveProperty('externalId');
      expectNoSecretsInWire(dto);
    });

    /**
     * Symmetric defense — if a future bug also adds `requires2FA: true` on
     * top of a successful `{ user }` shape, the user payload still cannot
     * leak credentials.
     */
    it('contamination defense — shape 3 + accidental requires2FA still safe', () => {
      const dto = toResponse(LoginResponseDto, {
        user: PRISMA_USER_WITH_SECRETS,
        requires2FA: true, // contamination
        tempToken: 'should-not-be-here',
      });
      const wire = wireShape(dto);
      // Both fields appear on the wire (DTO can't reject the mix), but no
      // credential reaches the wire.
      expect(wire.user).toBeDefined();
      expectNoSecretsInWire(dto);
    });
  });

  describe('SessionResponseDto', () => {
    const dto = toResponse(SessionResponseDto, {
      user: PRISMA_USER_WITH_SECRETS,
      isAuthenticated: true,
    });

    it('exposes the authenticated flag and the typed user ref', () => {
      expect(dto.isAuthenticated).toBe(true);
      expect(dto.user).toHaveProperty('email', 'admin@demo.fr');
      expect(dto.user).toHaveProperty('totpEnabled', true);
    });

    it('runtime serialization is leak-free', () => {
      expectNoSecretsInWire(dto);
    });
  });

  describe('TotpSetupResponseDto (plaintext is intentional — user-facing)', () => {
    const dto = toResponse(TotpSetupResponseDto, {
      secret: 'JBSWY3DPEHPK3PXP',
      qrCodeDataUrl: 'data:image/png;base64,iVBOR...',
      // Hypothetical contamination from a future bug.
      passwordHash: 'should-never-arrive',
      totpBackupCodes: ['leaked-1'],
    });

    it('exposes the plaintext secret and QR data URL', () => {
      expect(dto.secret).toBe('JBSWY3DPEHPK3PXP');
      expect(dto.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('drops contamination (passwordHash, backup codes) even when caller object includes them', () => {
      expect(dto).not.toHaveProperty('passwordHash');
      expect(dto).not.toHaveProperty('totpBackupCodes');
      const wire = JSON.stringify(instanceToPlain(dto));
      expect(wire).not.toMatch(/passwordHash/);
      expect(wire).not.toMatch(/leaked-1/);
    });
  });

  describe('TotpVerifySetupResponseDto (plaintext backup codes intentional — returned ONCE)', () => {
    const dto = toResponse(TotpVerifySetupResponseDto, {
      enabled: true,
      backupCodes: ['code-aaaa-1111', 'code-bbbb-2222', 'code-cccc-3333'],
      // Contamination check.
      totpSecret: 'JBSWY3DPEHPK3PXP',
      passwordHash: 'should-never-arrive',
    });

    it('exposes the enabled flag and plaintext backup codes', () => {
      expect(dto.enabled).toBe(true);
      expect(dto.backupCodes).toEqual([
        'code-aaaa-1111',
        'code-bbbb-2222',
        'code-cccc-3333',
      ]);
    });

    it('drops totpSecret / passwordHash even if accidentally passed in', () => {
      expect(dto).not.toHaveProperty('totpSecret');
      expect(dto).not.toHaveProperty('passwordHash');
      const wire = JSON.stringify(instanceToPlain(dto));
      expect(wire).not.toMatch(/totpSecret/);
      expect(wire).not.toMatch(/JBSWY3DPEHPK3PXP/);
      expect(wire).not.toMatch(/passwordHash/);
    });
  });

  describe('MyPermissionsResponseDto', () => {
    const composite = {
      isSuperAdmin: false,
      hasDelegation: true,
      allSitesAccess: false,
      accessibleSiteIds: ['site-1', 'site-2'],
      delegations: [
        {
          id: 'ud-1',
          userId: 'usr-1',
          delegationId: 'dlg-1',
          right: 'WRITE',
          grantedBy: 'manual',
          delegation: {
            id: 'dlg-1',
            name: 'Île-de-France',
            code: 'IDF',
            groupLabel: 'Régions',
            groupColor: '#0070f3',
            // contamination check
            _hidden: 'leak',
            secretField: 'must-not-appear',
          },
          // contamination check
          createdAt: new Date(),
          _internal: 'should-drop',
        },
      ],
    };
    const dto = toResponse(MyPermissionsResponseDto, composite);

    it('exposes the composite scalar fields', () => {
      expect(dto.isSuperAdmin).toBe(false);
      expect(dto.hasDelegation).toBe(true);
      expect(dto.allSitesAccess).toBe(false);
      expect(dto.accessibleSiteIds).toEqual(['site-1', 'site-2']);
    });

    it('embeds typed delegation items with sub-DTO whitelist', () => {
      expect(dto.delegations).toHaveLength(1);
      expect(dto.delegations[0]).toHaveProperty('right', 'WRITE');
      expect(dto.delegations[0]).toHaveProperty('grantedBy', 'manual');
      expect(dto.delegations[0].delegation).toEqual({
        id: 'dlg-1',
        name: 'Île-de-France',
        code: 'IDF',
        groupLabel: 'Régions',
        groupColor: '#0070f3',
      });
    });

    it('drops contamination on items and on embedded delegation ref', () => {
      expect(dto.delegations[0]).not.toHaveProperty('_internal');
      expect(dto.delegations[0]).not.toHaveProperty('createdAt');
      expect(dto.delegations[0].delegation).not.toHaveProperty('_hidden');
      expect(dto.delegations[0].delegation).not.toHaveProperty('secretField');
      const wire = JSON.stringify(instanceToPlain(dto));
      expect(wire).not.toMatch(/_internal/);
      expect(wire).not.toMatch(/_hidden/);
      expect(wire).not.toMatch(/secretField/);
      expect(wire).not.toMatch(/must-not-appear/);
    });

    it('handles full-tenant access via accessibleSiteIds === null', () => {
      const dtoFull = toResponse(MyPermissionsResponseDto, {
        ...composite,
        isSuperAdmin: true,
        allSitesAccess: true,
        accessibleSiteIds: null,
      });
      expect(dtoFull.accessibleSiteIds).toBeNull();
      expect(dtoFull.allSitesAccess).toBe(true);
    });
  });

  describe('SsoConfigResponseDto', () => {
    it('exposes ssoEnabled + provider', () => {
      const dto = toResponse(SsoConfigResponseDto, { ssoEnabled: true, provider: 'oidc' });
      expect(dto).toEqual({ ssoEnabled: true, provider: 'oidc' });
    });

    it('handles disabled state with null provider', () => {
      const dto = toResponse(SsoConfigResponseDto, { ssoEnabled: false, provider: null });
      expect(dto.ssoEnabled).toBe(false);
      expect(dto.provider).toBeNull();
    });
  });

  describe('InviteResponseDto', () => {
    const inviteWithToken = {
      id: 'usr-2',
      tenantId: 'tnt-1',
      email: 'newuser@demo.fr',
      name: 'New User',
      active: false,
      authProvider: 'local',
      inviteTokenExpiry: new Date('2026-05-08T00:00:00Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
      tenant: { id: 'tnt-1', name: 'Demo', subdomain: 'demo' },
      emailSent: false,
      // Plaintext token returned because SMTP failed — admin shares manually.
      inviteToken: 'plaintext-token-for-manual-sharing',
      // Contamination
      passwordHash: 'should-not-leak',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      failedLoginAttempts: 0,
    };

    it('exposes the invited user identity + emailSent + plaintext token (failure path)', () => {
      const dto = toResponse(InviteResponseDto, inviteWithToken);
      expect(dto.id).toBe('usr-2');
      expect(dto.email).toBe('newuser@demo.fr');
      expect(dto.emailSent).toBe(false);
      expect(dto.inviteToken).toBe('plaintext-token-for-manual-sharing');
      expect(dto.tenant).toEqual({ id: 'tnt-1', name: 'Demo', subdomain: 'demo' });
    });

    it('drops contamination (passwordHash, totpSecret, failedLoginAttempts)', () => {
      const dto = toResponse(InviteResponseDto, inviteWithToken);
      expect(dto).not.toHaveProperty('passwordHash');
      expect(dto).not.toHaveProperty('totpSecret');
      expect(dto).not.toHaveProperty('failedLoginAttempts');
      const wire = JSON.stringify(instanceToPlain(dto));
      expect(wire).not.toMatch(/passwordHash/);
      expect(wire).not.toMatch(/totpSecret/);
      expect(wire).not.toMatch(/JBSWY3DPEHPK3PXP/);
      expect(wire).not.toMatch(/failedLoginAttempts/);
    });

    it('omits inviteToken when emailSent is true (success path)', () => {
      // Service convention: when SMTP succeeds, inviteToken is absent from the
      // response. The DTO declares it optional and class-transformer drops
      // missing optional fields from the wire.
      const dtoSuccess = toResponse(InviteResponseDto, {
        ...inviteWithToken,
        emailSent: true,
        inviteToken: undefined,
      });
      const wire = wireShape(dtoSuccess);
      expect(wire.emailSent).toBe(true);
      expect(wire).not.toHaveProperty('inviteToken');
    });
  });

  describe('Action result DTOs (success / disabled / message variants)', () => {
    it('AuthSuccessResultResponseDto exposes only `success`', () => {
      const dto = toResponse(AuthSuccessResultResponseDto, { success: true });
      expect(dto).toEqual({ success: true });
    });

    it('TotpDisabledResultResponseDto exposes only `disabled`', () => {
      const dto = toResponse(TotpDisabledResultResponseDto, { disabled: true });
      expect(dto).toEqual({ disabled: true });
    });

    it('AuthMessageResultResponseDto exposes message + optional success', () => {
      const dto = toResponse(AuthMessageResultResponseDto, {
        success: true,
        message: 'Compte activé avec succès',
      });
      expect(dto.success).toBe(true);
      expect(dto.message).toBe('Compte activé avec succès');
    });

    it('AuthMessageResultResponseDto drops contamination', () => {
      const dto = toResponse(AuthMessageResultResponseDto, {
        success: true,
        message: 'ok',
        passwordHash: 'should-drop',
        token: 'should-drop',
      });
      expect(dto).not.toHaveProperty('passwordHash');
      expect(dto).not.toHaveProperty('token');
      const wire = JSON.stringify(instanceToPlain(dto));
      expect(wire).not.toMatch(/passwordHash/);
      expect(wire).not.toMatch(/token/);
    });
  });
});
