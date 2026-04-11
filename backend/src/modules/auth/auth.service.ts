import { Injectable, UnauthorizedException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient, UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EmailService } from '../../common/services/email.service';

interface SsoDelegationEntry {
  delegationId: string;
  role?: UserRole;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaClient,
    private jwtService: JwtService,
    private config: ConfigService,
    private emailService: EmailService,
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
    // Get tenant-level security config for session timeouts
    const tenant = await this.prisma.tenant.findUnique({ where: { id: user.tenantId } });
    const tenantConfig = (tenant?.config as Record<string, any>) || {};
    const security = tenantConfig?.security || {};

    const sessionTimeout = security.sessionTimeout || this.config.get('JWT_ACCESS_EXPIRATION', '15m');
    const refreshLifetime = security.refreshTokenLifetime || this.config.get('JWT_REFRESH_EXPIRATION', '7d');

    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      isSuperAdmin: user.isSuperAdmin || false,
      // NOTE: role deliberately excluded from JWT — source of truth is UserDelegation.role
      // resolved per-request by DelegationGuard via X-Delegation-Id header
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: sessionTimeout });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: refreshLifetime });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Parse session timeout for cookie maxAge
    const sessionMs = this.parseTimeToMs(sessionTimeout);
    const refreshMs = this.parseTimeToMs(refreshLifetime);

    return {
      accessToken,
      refreshToken,
      sessionMs,
      refreshMs,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role, // Legacy default — NOT used for permissions (display only)
        isSuperAdmin: user.isSuperAdmin || false,
        tenantId: user.tenantId,
        tenant: user.tenant,
        totpEnabled: user.totpEnabled || false,
      },
    };
  }

  /** Parse time string like '15m', '1h', '7d' to milliseconds */
  private parseTimeToMs(time: string): number {
    const match = time.match(/^(\d+)(m|h|d|s)$/);
    if (!match) return 15 * 60 * 1000; // default 15min
    const value = parseInt(match[1], 10);
    switch (match[2]) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 15 * 60 * 1000;
    }
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

  async oidcLogin(profile: any, tenantId: string, role?: string, scopes?: SsoDelegationEntry[]) {
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

    // Sync UserDelegations from SSO mapping (IdP is source of truth for delegation access)
    if (scopes && scopes.length > 0) {
      await this.syncSsoDelegations(tenantId, user.id, scopes);
    }

    return this.login(user);
  }

  /**
   * Sync user delegation access from SSO group mapping.
   * Replaces all existing SSO-sourced delegations with the new ones from the IdP.
   */
  private async syncSsoDelegations(tenantId: string, userId: string, delegations: SsoDelegationEntry[]) {
    try {
      // Delete existing delegations granted by SSO (IdP is source of truth — full replace)
      await this.prisma.userDelegation.deleteMany({
        where: { userId, tenantId, grantedBy: 'sso' },
      });

      // Create new delegation access from SSO mapping
      const delegationData = delegations.map((d) => ({
        tenantId,
        userId,
        delegationId: d.delegationId,
        role: d.role || ('VIEWER' as UserRole),
        grantedBy: 'sso',
      }));

      if (delegationData.length > 0) {
        await this.prisma.userDelegation.createMany({
          data: delegationData,
          skipDuplicates: true,
        });
      }

      this.logger.log(`Synced ${delegationData.length} delegation access for SSO user ${userId}`);
    } catch (error) {
      this.logger.warn(`Failed to sync SSO delegations for user ${userId}: ${error.message}`);
      // Don't fail login if delegation sync fails
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

  // ===== Invite =====

  async invite(adminTenantId: string, email: string, name: string, role?: string) {
    // Check if user already exists in this tenant
    const existing = await this.prisma.user.findFirst({
      where: { tenantId: adminTenantId, email },
    });
    if (existing) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà dans ce tenant');
    }

    const token = crypto.randomUUID();
    const expiry = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h

    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        role: (role as UserRole) || 'VIEWER',
        active: false,
        tenantId: adminTenantId,
        authProvider: 'local',
        inviteToken: token,
        inviteTokenExpiry: expiry,
      },
      include: { tenant: true },
    });

    // Send invitation email (graceful: if SMTP fails, return token for manual sharing)
    const emailSent = await this.emailService.sendInvitation(email, name, token, user.tenant?.name);

    const { passwordHash, totpSecret, totpBackupCodes, inviteToken: _it, resetToken: _rt, ...result } = user;

    // If email was not actually sent (SMTP not configured or failed), return token so admin can share link
    if (!emailSent) {
      return { ...result, inviteToken: token, emailSent: false };
    }
    return { ...result, emailSent: true };
  }

  async acceptInvite(token: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        inviteToken: token,
        inviteTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Token invalide ou expiré');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        active: true,
        inviteToken: null,
        inviteTokenExpiry: null,
      },
    });

    return { success: true, message: 'Compte activé avec succès' };
  }

  // ===== Forgot / Reset Password =====

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, active: true, authProvider: 'local' },
    });

    // Always return success to avoid revealing user existence
    if (!user) {
      return { success: true, message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.' };
    }

    const token = crypto.randomUUID();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry,
      },
    });

    await this.emailService.sendPasswordReset(email, user.name, token);

    return { success: true, message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Token invalide ou expiré');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return { success: true, message: 'Mot de passe réinitialisé avec succès' };
  }
}
