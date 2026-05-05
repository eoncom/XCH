import { instanceToPlain } from 'class-transformer';
import { TenantStatus } from '@prisma/client';
import { toResponse } from '../../common/utils/to-response.util';
import { TenantResponseDto } from './dto/tenant.response.dto';
import { TenantCurrentConfigResponseDto } from './dto/tenant-current-config.response.dto';
import { TenantModulesResponseDto } from './dto/tenant-modules.response.dto';
import { TenantSsoConfigResponseDto } from './dto/tenant-sso-config.response.dto';
import { TenantSecurityConfigResponseDto } from './dto/tenant-security-config.response.dto';
import { TenantElectricityConfigResponseDto } from './dto/tenant-electricity-config.response.dto';
import { TenantAppearanceResponseDto } from './dto/tenant-appearance.response.dto';

describe('Tenants response DTO shapes', () => {
  describe('TenantResponseDto', () => {
    it('exposes scalars + config passthrough, strips extras', () => {
      const dto = toResponse(TenantResponseDto, {
        id: 'tnt-1',
        name: 'Demo',
        slug: 'demo',
        logoUrl: null,
        primaryColor: '#0070f3',
        status: TenantStatus.ACTIVE,
        allowInternalNetworkTargets: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        config: { branding: { theme: 'dark' }, modules: { sites: true } },
        // Extraneous.
        _internal: 'leak',
        passwordHash: 'never',
      });
      expect(dto).toHaveProperty('id', 'tnt-1');
      expect(dto).toHaveProperty('name', 'Demo');
      expect(dto.config).toMatchObject({ branding: { theme: 'dark' } });
      expect(dto).not.toHaveProperty('_internal');
      expect(dto).not.toHaveProperty('passwordHash');
    });
  });

  describe('TenantCurrentConfigResponseDto', () => {
    it('exposes branding fields + assembled config passthrough', () => {
      const dto = toResponse(TenantCurrentConfigResponseDto, {
        name: 'Demo',
        logoUrl: null,
        primaryColor: '#0070f3',
        config: { sso: { enabled: true }, modules: {} },
        _internal: 'leak',
      });
      expect(dto).toHaveProperty('name', 'Demo');
      expect(dto.config).toMatchObject({ sso: { enabled: true } });
      expect(dto).not.toHaveProperty('_internal');
    });
  });

  describe('TenantModulesResponseDto', () => {
    it('exposes typed modules array', () => {
      const dto = toResponse(TenantModulesResponseDto, {
        modules: [
          { key: 'sites', label: 'Sites', description: 'Gestion des sites', enabled: true },
          { key: 'assets', label: 'Équipements', description: 'Inventaire', enabled: false },
        ],
      });
      expect(dto.modules).toHaveLength(2);
      expect(dto.modules[0]).toHaveProperty('enabled', true);
      expect(dto.modules[1]).toHaveProperty('enabled', false);
    });
  });

  describe('TenantSsoConfigResponseDto (secret masked)', () => {
    const sso = {
      enabled: true,
      provider: 'oidc',
      issuer: 'https://idp.example.com',
      clientId: 'xch-client',
      clientSecretSet: true,
      clientSecretHint: '****abcd',
      callbackUrl: 'https://xch/callback',
      roleMapping: { admin: 'MANAGE', technician: 'READ' },
      // Sensitive — service must NEVER include the real secret.
      clientSecret: 'real-secret-do-not-leak',
      _internalDebug: 'leak',
    };

    it('exposes hint, drops real secret + extras', () => {
      const dto = toResponse(TenantSsoConfigResponseDto, sso);
      expect(dto).toHaveProperty('clientSecretSet', true);
      expect(dto).toHaveProperty('clientSecretHint', '****abcd');
      expect(dto).not.toHaveProperty('clientSecret');
      expect(dto).not.toHaveProperty('_internalDebug');
      expect(dto.roleMapping).toEqual({ admin: 'MANAGE', technician: 'READ' });
    });

    it('runtime serialization NEVER leaks the real client secret', () => {
      const dto = toResponse(TenantSsoConfigResponseDto, sso);
      const wireJson = JSON.stringify(instanceToPlain(dto));
      expect(wireJson).not.toMatch(/real-secret-do-not-leak/);
      expect(wireJson).not.toMatch(/_internalDebug/);
    });
  });

  describe('TenantSecurityConfigResponseDto', () => {
    it('exposes 2FA + timeout fields', () => {
      const dto = toResponse(TenantSecurityConfigResponseDto, {
        require2FA: true,
        sessionTimeout: '15m',
        refreshTokenLifetime: '7d',
        _hidden: 'leak',
      });
      expect(dto).toEqual({ require2FA: true, sessionTimeout: '15m', refreshTokenLifetime: '7d' });
    });
  });

  describe('TenantElectricityConfigResponseDto', () => {
    it('exposes cost + currency', () => {
      const dto = toResponse(TenantElectricityConfigResponseDto, {
        costPerKwh: 0.18,
        currency: 'EUR',
      });
      expect(dto).toEqual({ costPerKwh: 0.18, currency: 'EUR' });
    });
  });

  describe('TenantAppearanceResponseDto', () => {
    it('exposes theme/primaryColor/density/allowUserOverride', () => {
      const dto = toResponse(TenantAppearanceResponseDto, {
        theme: 'dark',
        primaryColor: '#0070f3',
        density: 'comfortable',
        allowUserOverride: true,
      });
      expect(dto).toEqual({
        theme: 'dark',
        primaryColor: '#0070f3',
        density: 'comfortable',
        allowUserOverride: true,
      });
    });
  });
});
