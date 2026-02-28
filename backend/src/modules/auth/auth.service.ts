import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient, UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
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

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
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

  async oidcLogin(profile: any, tenantId: string, role?: string) {
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

    return this.login(user);
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
