import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-openidconnect';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../auth.service';

/**
 * Default role mapping: OIDC groups/roles → XCH roles.
 * Can be overridden per tenant via Tenant.config.sso.roleMapping.
 */
const DEFAULT_ROLE_MAPPING: Record<string, string> = {
  admin: 'ADMIN',
  manager: 'MANAGER',
  technician: 'TECHNICIEN',
  technicien: 'TECHNICIEN',
  viewer: 'VIEWER',
};

@Injectable()
export class OidcStrategy extends PassportStrategy(Strategy, 'oidc') {
  constructor(
    private config: ConfigService,
    private authService: AuthService,
    private prisma: PrismaClient,
  ) {
    const enabled = config.get('OIDC_ENABLED') === 'true';

    super({
      issuer: enabled ? config.get('OIDC_ISSUER') : 'http://localhost',
      authorizationURL: enabled ? config.get('OIDC_AUTHORIZATION_URL') || `${config.get('OIDC_ISSUER')}/authorize` : 'http://localhost/authorize',
      tokenURL: enabled ? config.get('OIDC_TOKEN_URL') || `${config.get('OIDC_ISSUER')}/token` : 'http://localhost/token',
      clientID: enabled ? config.get('OIDC_CLIENT_ID') : 'dummy',
      clientSecret: enabled ? config.get('OIDC_CLIENT_SECRET') : 'dummy',
      callbackURL: enabled ? config.get('OIDC_CALLBACK_URL') : 'http://localhost/callback',
      scope: 'openid profile email',
      skipUserProfile: false,
    });
  }

  async validate(issuer: string, profile: any, done: Function) {
    try {
      // Find the active tenant (single-tenant mode)
      const tenant = await this.prisma.tenant.findFirst({
        where: { status: 'ACTIVE' },
      });

      const tenantId = tenant?.id || this.config.get('DEFAULT_TENANT_ID') || 'tenant_default';

      // Determine role from OIDC claims
      const role = this.mapRole(profile, tenant?.config as Record<string, any> | null);

      const user = await this.authService.oidcLogin(profile, tenantId, role);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }

  /**
   * Map OIDC profile claims to an XCH role.
   * Checks profile.groups, profile._json.roles, profile._json.groups.
   * Uses tenant-level roleMapping if available, else falls back to defaults.
   */
  private mapRole(profile: any, tenantConfig: Record<string, any> | null): string {
    const roleMapping = tenantConfig?.sso?.roleMapping || DEFAULT_ROLE_MAPPING;
    const defaultRole = roleMapping.default || 'VIEWER';

    // Try to find groups/roles from profile
    const groups: string[] = [
      ...(profile.groups || []),
      ...(profile._json?.groups || []),
      ...(profile._json?.roles || []),
    ];

    // Check each group against mapping
    for (const group of groups) {
      const groupLower = (group || '').toLowerCase();
      // Check exact match first
      if (roleMapping[group]) return roleMapping[group];
      if (roleMapping[groupLower]) return roleMapping[groupLower];
      // Check if group contains a key
      for (const [key, mappedRole] of Object.entries(roleMapping)) {
        if (key !== 'default' && groupLower.includes(key.toLowerCase())) {
          return mappedRole as string;
        }
      }
    }

    return defaultRole;
  }
}
