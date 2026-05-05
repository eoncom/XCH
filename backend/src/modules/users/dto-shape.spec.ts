import { instanceToPlain } from 'class-transformer';
import { toResponse } from '../../common/utils/to-response.util';
import { UserResponseDto } from './dto/user.response.dto';
import { UserListResponseDto } from './dto/user-list.response.dto';
import { UserProfileResponseDto } from './dto/user-profile.response.dto';
import { UserAppearanceResponseDto } from './dto/user-appearance.response.dto';
import { UserEffectiveAppearanceResponseDto } from './dto/user-effective-appearance.response.dto';
import {
  UserDeletedResultResponseDto,
  UserPasswordChangedResultResponseDto,
  UserToggleSuperAdminResultResponseDto,
} from './dto/user-action-result.response.dto';

describe('Users response DTO shapes', () => {
  describe('UserResponseDto — CRITICAL: sensitive fields MUST NEVER leak', () => {
    const prismaLikeUser = {
      id: 'usr-1',
      tenantId: 'tnt-1',
      email: 'admin@demo.fr',
      name: 'Admin Demo',
      phone: '+33 6 00 00 00 00',
      avatarUrl: null,
      isSuperAdmin: true,
      active: true,
      externalId: null,
      authProvider: 'local',
      totpEnabled: true,
      lastLoginAt: new Date('2026-05-05T10:00:00Z'),
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-04-15T00:00:00Z'),
      // CRITICAL — sensitive fields, must NOT roundtrip to the wire.
      passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyzABCDEF',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      totpBackupCodes: ['code-1', 'code-2', 'code-3'],
      inviteToken: 'inv-token-secret',
      inviteTokenExpiry: new Date(),
      resetToken: 'reset-token-secret',
      resetTokenExpiry: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
      // Appearance scalars.
      appearanceTheme: 'dark',
      appearancePrimaryColor: '#0070f3',
      appearanceDensity: 'comfortable',
      appearanceSource: 'custom',
    };

    const dto = toResponse(UserResponseDto, prismaLikeUser);

    it('exposes legitimate identity / profile fields', () => {
      expect(dto).toHaveProperty('id', 'usr-1');
      expect(dto).toHaveProperty('email', 'admin@demo.fr');
      expect(dto).toHaveProperty('name', 'Admin Demo');
      expect(dto).toHaveProperty('isSuperAdmin', true);
      expect(dto).toHaveProperty('totpEnabled', true);
    });

    it('does NOT expose any sensitive credential field', () => {
      expect(dto).not.toHaveProperty('passwordHash');
      expect(dto).not.toHaveProperty('totpSecret');
      expect(dto).not.toHaveProperty('totpBackupCodes');
      expect(dto).not.toHaveProperty('inviteToken');
      expect(dto).not.toHaveProperty('resetToken');
      expect(dto).not.toHaveProperty('failedLoginAttempts');
      expect(dto).not.toHaveProperty('lockedUntil');
    });

    it('runtime serialization NEVER puts a real secret on the wire', () => {
      const wireJson = JSON.stringify(instanceToPlain(dto));
      expect(wireJson).not.toMatch(/passwordHash/);
      expect(wireJson).not.toMatch(/\$2b\$12\$/); // bcrypt prefix
      expect(wireJson).not.toMatch(/totpSecret/);
      expect(wireJson).not.toMatch(/JBSWY3DPEHPK3PXP/); // example TOTP base32
      expect(wireJson).not.toMatch(/totpBackupCodes/);
      expect(wireJson).not.toMatch(/inviteToken/);
      expect(wireJson).not.toMatch(/resetToken/);
      expect(wireJson).not.toMatch(/code-1/); // backup code value
    });

    it('exposes appearance scalars via @Transform({obj}) passthrough', () => {
      expect(dto.appearanceTheme).toBe('dark');
      expect(dto.appearancePrimaryColor).toBe('#0070f3');
      expect(dto.appearanceDensity).toBe('comfortable');
      expect(dto.appearanceSource).toBe('custom');
    });
  });

  describe('UserResponseDto with tenant + userDelegations relations', () => {
    it('embeds typed sub-DTOs', () => {
      const dto = toResponse(UserResponseDto, {
        id: 'usr-2',
        tenantId: 'tnt-1',
        email: 'tech@demo.fr',
        name: 'Tech',
        isSuperAdmin: false,
        active: true,
        authProvider: 'local',
        totpEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        tenant: { id: 'tnt-1', name: 'Demo', _internal: 'leak' },
        userDelegations: [
          {
            id: 'ud-1',
            userId: 'usr-2',
            delegationId: 'dlg-1',
            right: 'WRITE',
            delegation: { id: 'dlg-1', name: 'Demo Default', groupLabel: null, _hidden: 'leak' },
          },
        ],
      });
      expect(dto.tenant).toHaveProperty('name', 'Demo');
      expect(dto.tenant).not.toHaveProperty('_internal');
      expect(dto.userDelegations).toHaveLength(1);
      expect(dto.userDelegations?.[0]).toHaveProperty('right', 'WRITE');
      expect(dto.userDelegations?.[0].delegation).toHaveProperty('name', 'Demo Default');
      expect(dto.userDelegations?.[0].delegation).not.toHaveProperty('_hidden');
    });
  });

  describe('UserListResponseDto', () => {
    it('maps data + meta', () => {
      const dto = toResponse(UserListResponseDto, {
        data: [
          {
            id: 'u-1',
            tenantId: 't',
            email: 'a@b.c',
            name: 'A',
            isSuperAdmin: false,
            active: true,
            authProvider: 'local',
            totpEnabled: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        meta: { total: 1, page: 1, pageSize: 25, totalPages: 1 },
      });
      expect(dto.data).toHaveLength(1);
      expect(dto.meta).toEqual({ total: 1, page: 1, pageSize: 25, totalPages: 1 });
    });
  });

  describe('UserProfileResponseDto — second line of defense for sensitive fields', () => {
    it('strips sensitive fields even if service forgets to omit them', () => {
      const dto = toResponse(UserProfileResponseDto, {
        id: 'usr-1',
        email: 'me@demo.fr',
        name: 'Me',
        isSuperAdmin: false,
        authProvider: 'local',
        totpEnabled: false,
        createdAt: new Date(),
        // CRITICAL — service should NEVER include these in profile response,
        // but the DTO whitelist provides defense in depth.
        passwordHash: 'bcrypt-hash',
        totpSecret: 'totp-secret',
        totpBackupCodes: ['x'],
      });
      expect(dto).not.toHaveProperty('passwordHash');
      expect(dto).not.toHaveProperty('totpSecret');
      expect(dto).not.toHaveProperty('totpBackupCodes');
    });
  });

  describe('UserAppearanceResponseDto', () => {
    it('exposes source + preference (custom)', () => {
      const dto = toResponse(UserAppearanceResponseDto, {
        source: 'custom',
        preference: { theme: 'dark', primaryColor: '#0070f3' },
      });
      expect(dto.source).toBe('custom');
      expect(dto.preference).toEqual({ theme: 'dark', primaryColor: '#0070f3' });
    });

    it('exposes source + null preference (inherit)', () => {
      const dto = toResponse(UserAppearanceResponseDto, { source: 'inherit', preference: null });
      expect(dto.source).toBe('inherit');
      expect(dto.preference).toBeNull();
    });
  });

  describe('UserEffectiveAppearanceResponseDto', () => {
    it('exposes resolved fields + tenant/user passthrough', () => {
      const dto = toResponse(UserEffectiveAppearanceResponseDto, {
        theme: 'dark',
        primaryColor: '#0070f3',
        density: 'comfortable',
        allowUserOverride: true,
        source: 'custom',
        tenant: { theme: 'light', primaryColor: '#ffffff', density: 'comfortable', allowUserOverride: true },
        user: { theme: 'dark', primaryColor: '#0070f3' },
      });
      expect(dto.theme).toBe('dark');
      expect(dto.source).toBe('custom');
      expect(dto.tenant).toMatchObject({ theme: 'light' });
      expect(dto.user).toMatchObject({ theme: 'dark' });
    });
  });

  describe('Action result shapes', () => {
    it('UserDeletedResultResponseDto', () => {
      expect(toResponse(UserDeletedResultResponseDto, { message: 'User deleted successfully' })).toEqual({
        message: 'User deleted successfully',
      });
    });

    it('UserPasswordChangedResultResponseDto', () => {
      expect(
        toResponse(UserPasswordChangedResultResponseDto, { message: 'Password changed successfully' }),
      ).toEqual({ message: 'Password changed successfully' });
    });

    it('UserToggleSuperAdminResultResponseDto runs UserResponseDto whitelist on user payload', () => {
      const dto = toResponse(UserToggleSuperAdminResultResponseDto, {
        message: 'User promoted',
        user: {
          id: 'u-1',
          tenantId: 't',
          email: 'a@b.c',
          name: 'A',
          isSuperAdmin: true,
          active: true,
          authProvider: 'local',
          totpEnabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          passwordHash: 'leak-bcrypt',
          totpSecret: 'leak-totp',
        },
      });
      expect(dto).toHaveProperty('message', 'User promoted');
      expect(dto.user).toHaveProperty('email', 'a@b.c');
      expect(dto.user).not.toHaveProperty('passwordHash');
      expect(dto.user).not.toHaveProperty('totpSecret');
    });
  });
});
