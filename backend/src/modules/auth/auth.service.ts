import { Injectable, UnauthorizedException, Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient, UserRole, ScopeType } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

interface SsoScopeEntry {
  type: 'TENANT' | 'DIVISION' | 'DELEGATION' | 'SITE';
  id?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaClient,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        active: true,
      },
      include: { tenant: true },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is temporarily locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMin = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(
        `Compte temporairement verrouillé. Réessayez dans ${remainingMin} minute(s).`,
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      // Increment failed attempts, lock after 5 failures
      const newAttempts = (user.failedLoginAttempts || 0) + 1;
      const lockData: any = { failedLoginAttempts: newAttempts };
      if (newAttempts >= 5) {
        lockData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lockout
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: lockData,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Successful login — reset failed attempts
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const { passwordHash, totpSecret, totpBackupCodes, ...result } = user;
    return result;
  }

  async login(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.config.get('JWT_REFRESH_EXPIRATION', '7d'),
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        tenant: user.tenant,
        totpEnabled: user.totpEnabled || false,
      },
    };
  }

  async register(data: { email: string; password: string; name: string; tenantId: string }) {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: hashedPassword,
        name: data.name,
        tenantId: data.tenantId,
        role: 'VIEWER',
        authProvider: 'local',
      },
      include: { tenant: true },
    });

    const { passwordHash, totpSecret, totpBackupCodes, ...result } = user;
    return result;
  }

  async oidcLogin(profile: any, tenantId: string, role?: string, scopes?: SsoScopeEntry[]) {
    const mappedRole = (role || 'VIEWER') as UserRole;

    let user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        externalId: profile.id,
      },
      include: { tenant: true },
    });

    if (!user) {
      // First login — create user with mapped role
      user = await this.prisma.user.create({
        data: {
          email: profile.emails?.[0]?.value || profile.email,
          name: profile.displayName || profile.name,
          externalId: profile.id,
          authProvider: 'oidc',
          tenantId,
          role: mappedRole,
        },
        include: { tenant: true },
      });
    } else {
      // Subsequent login — update role if it changed (IdP is the source of truth)
      if (user.role !== mappedRole) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { role: mappedRole },
          include: { tenant: true },
        });
      }
    }

    // Sync UserScopes from SSO mapping (IdP is source of truth for scopes too)
    if (scopes && scopes.length > 0) {
      await this.syncSsoScopes(tenantId, user.id, scopes);
    }

    return this.login(user);
  }

  /**
   * Sync user scopes from SSO group mapping.
   * Replaces all existing SSO-sourced scopes with the new ones from the IdP.
   */
  private async syncSsoScopes(tenantId: string, userId: string, scopes: SsoScopeEntry[]) {
    try {
      // Delete existing scopes (IdP is source of truth — full replace)
      await this.prisma.userScope.deleteMany({
        where: { userId, tenantId },
      });

      // Create new scopes from SSO mapping
      const scopeData = scopes.map((s) => ({
        tenantId,
        userId,
        scopeType: s.type as ScopeType,
        scopeId: s.id || null,
        grantedBy: 'sso',
      }));

      if (scopeData.length > 0) {
        await this.prisma.userScope.createMany({
          data: scopeData,
          skipDuplicates: true,
        });
      }

      this.logger.log(`Synced ${scopeData.length} scopes for SSO user ${userId}`);
    } catch (error) {
      this.logger.warn(`Failed to sync SSO scopes for user ${userId}: ${error.message}`);
      // Don't fail login if scope sync fails
    }
  }

  async refreshAccessToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { tenant: true },
      });

      if (!user || !user.active) {
        throw new UnauthorizedException();
      }

      return this.login(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
