import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-openidconnect';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, DelegationRight } from '@prisma/client';
import { AuthService } from '../auth.service';

/**
 * Default OIDC group → DelegationRight mapping.
 * Can be overridden per tenant via Tenant.config.sso.roleMapping.
 * Both legacy labels (ADMIN/MANAGER/TECHNICIEN/VIEWER, pre-v1.2) and
 * new ones (MANAGE/WRITE/READ) are accepted — normalizeRight() translates.
 */
const DEFAULT_ROLE_MAPPING: Record<string, string> = {
  admin: 'MANAGE',
  manager: 'MANAGE',
  technician: 'WRITE',
  technicien: 'WRITE',
  viewer: 'READ',
};

/**
 * Translate a configured role label into a DelegationRight.
 * Accepts legacy User.role values (deprecated since v1.2) for backward compat.
 *
 * Exported (S4 — testability): used by oidc.strategy.spec.ts. Pure function,
 * no side effects.
 */
export function normalizeRight(value: string | undefined): DelegationRight {
  if (!value) return 'READ';
  const upper = value.toUpperCase();
  switch (upper) {
    case 'MANAGE':
    case 'ADMIN':
    case 'MANAGER':
      return 'MANAGE';
    case 'WRITE':
    case 'TECHNICIEN':
    case 'TECHNICIAN':
      return 'WRITE';
    case 'READ':
    case 'VIEWER':
      return 'READ';
    default:
      return 'READ';
  }
}

/**
 * A mapping entry can be a simple string (role only, backward compat)
 * or an object with role + scopes for the new access model.
 */
interface ScopeEntry {
  type: 'DELEGATION' | 'SITE';
  id?: string;
}

interface RoleMappingEntry {
  role: string;
  scopes?: ScopeEntry[];
}

interface SsoDelegationEntry {
  delegationId: string;
  right: DelegationRight;
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

      // Determine right + scopes from OIDC claims
      const { right, scopes } = this.mapRightAndScopes(profile, tenantConfig);

      // Convert scopes to SsoDelegationEntry format for auth service
      const delegationEntries: SsoDelegationEntry[] = scopes
        .filter(s => s.type === 'DELEGATION' && s.id)
        .map(s => ({ delegationId: s.id!, right }));

      const user = await this.authService.oidcLogin(profile, tenantId, right, delegationEntries);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }

  /**
   * Map OIDC profile claims to a DelegationRight + scopes.
   * Supports both legacy format (string values) and new format (object with role+scopes).
   *
   * Legacy:  { "admin": "MANAGE", "tech": "WRITE" }
   * Also accepted (backward compat): { "admin": "ADMIN", "tech": "TECHNICIEN" }
   * New:     { "admin": { "role": "MANAGE", "scopes": [{ "type": "DELEGATION", "id": "d-123" }] } }
   */
  private mapRightAndScopes(
    profile: any,
    tenantConfig: Record<string, any> | null,
  ): { right: DelegationRight; scopes: ScopeEntry[] } {
    const roleMapping: Record<string, string | RoleMappingEntry> = tenantConfig?.sso?.roleMapping || DEFAULT_ROLE_MAPPING;
    const defaultEntry = roleMapping.default;
    const defaultRoleStr = typeof defaultEntry === 'object' ? defaultEntry.role : (defaultEntry || 'READ');
    const defaultScopes: ScopeEntry[] = typeof defaultEntry === 'object' ? (defaultEntry.scopes || []) : [];

    // Extract groups/roles from OIDC profile
    const groups: string[] = [
      ...(profile.groups || []),
      ...(profile._json?.groups || []),
      ...(profile._json?.roles || []),
    ];

    // Collect all matching scopes (union from all matched groups)
    const allScopes: ScopeEntry[] = [];
    let matchedRoleStr: string | null = null;

    const resolveEntry = (entry: string | RoleMappingEntry): { role: string; scopes: ScopeEntry[] } => {
      if (typeof entry === 'string') return { role: entry, scopes: [] };
      return { role: entry.role, scopes: entry.scopes || [] };
    };

    for (const group of groups) {
      const groupLower = (group || '').toLowerCase();

      // Check exact match
      if (roleMapping[group]) {
        const { role, scopes } = resolveEntry(roleMapping[group]);
        if (!matchedRoleStr) matchedRoleStr = role;
        allScopes.push(...scopes);
        continue;
      }
      if (roleMapping[groupLower]) {
        const { role, scopes } = resolveEntry(roleMapping[groupLower]);
        if (!matchedRoleStr) matchedRoleStr = role;
        allScopes.push(...scopes);
        continue;
      }

      // Check substring match
      for (const [key, mappedEntry] of Object.entries(roleMapping)) {
        if (key !== 'default' && groupLower.includes(key.toLowerCase())) {
          const { role, scopes } = resolveEntry(mappedEntry as string | RoleMappingEntry);
          if (!matchedRoleStr) matchedRoleStr = role;
          allScopes.push(...scopes);
          break;
        }
      }
    }

    return {
      right: normalizeRight(matchedRoleStr || defaultRoleStr),
      scopes: allScopes.length > 0 ? allScopes : defaultScopes,
    };
  }
}
