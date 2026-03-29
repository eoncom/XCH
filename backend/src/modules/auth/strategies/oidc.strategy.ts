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

/**
 * A mapping entry can be a simple string (role only, backward compat)
 * or an object with role + scopes for the new access model.
 */
interface ScopeEntry {
  type: 'TENANT' | 'DIVISION' | 'DELEGATION' | 'SITE';
  id?: string; // null for TENANT
}

interface RoleMappingEntry {
  role: string;
  scopes?: ScopeEntry[];
}

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
      const tenantConfig = tenant?.config as Record<string, any> | null;

      // Determine role + scopes from OIDC claims
      const { role, scopes } = this.mapRoleAndScopes(profile, tenantConfig);

      const user = await this.authService.oidcLogin(profile, tenantId, role, scopes);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }

  /**
   * Map OIDC profile claims to an XCH role + scopes.
   * Supports both legacy format (string values) and new format (object with role+scopes).
   *
   * Legacy:  { "admin": "ADMIN", "tech": "TECHNICIEN" }
   * New:     { "admin": { "role": "ADMIN", "scopes": [{ "type": "TENANT" }] },
   *            "tech-idf": { "role": "TECHNICIEN", "scopes": [{ "type": "DIVISION", "id": "div-123" }] } }
   */
  private mapRoleAndScopes(
    profile: any,
    tenantConfig: Record<string, any> | null,
  ): { role: string; scopes: ScopeEntry[] } {
    const roleMapping: Record<string, string | RoleMappingEntry> = tenantConfig?.sso?.roleMapping || DEFAULT_ROLE_MAPPING;
    const defaultEntry = roleMapping.default;
    const defaultRole = typeof defaultEntry === 'object' ? defaultEntry.role : (defaultEntry || 'VIEWER');
    const defaultScopes: ScopeEntry[] = typeof defaultEntry === 'object' ? (defaultEntry.scopes || []) : [];

    // Extract groups/roles from OIDC profile
    const groups: string[] = [
      ...(profile.groups || []),
      ...(profile._json?.groups || []),
      ...(profile._json?.roles || []),
    ];

    // Collect all matching scopes (union from all matched groups)
    const allScopes: ScopeEntry[] = [];
    let matchedRole: string | null = null;

    const resolveEntry = (entry: string | RoleMappingEntry): { role: string; scopes: ScopeEntry[] } => {
      if (typeof entry === 'string') return { role: entry, scopes: [] };
      return { role: entry.role, scopes: entry.scopes || [] };
    };

    for (const group of groups) {
      const groupLower = (group || '').toLowerCase();

      // Check exact match
      if (roleMapping[group]) {
        const { role, scopes } = resolveEntry(roleMapping[group]);
        if (!matchedRole) matchedRole = role;
        allScopes.push(...scopes);
        continue;
      }
      if (roleMapping[groupLower]) {
        const { role, scopes } = resolveEntry(roleMapping[groupLower]);
        if (!matchedRole) matchedRole = role;
        allScopes.push(...scopes);
        continue;
      }

      // Check substring match
      for (const [key, mappedEntry] of Object.entries(roleMapping)) {
        if (key !== 'default' && groupLower.includes(key.toLowerCase())) {
          const { role, scopes } = resolveEntry(mappedEntry as string | RoleMappingEntry);
          if (!matchedRole) matchedRole = role;
          allScopes.push(...scopes);
          break;
        }
      }
    }

    return {
      role: matchedRole || defaultRole,
      scopes: allScopes.length > 0 ? allScopes : defaultScopes,
    };
  }
}
