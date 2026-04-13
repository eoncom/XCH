import { Controller, Post, Body, UseGuards, Request, Get, Res, UnauthorizedException, Req, Delete, Param, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { Response, Request as ExpressRequest } from 'express';
import * as bcrypt from 'bcrypt';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { TotpService } from './totp.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthRequest } from '../../types/request.interface';
import { SkipDelegation } from '../../common/decorators/skip-delegation.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequireWrite, RequireManage } from '../../common/decorators/require-right.decorator';

@ApiTags('auth')
@SkipDelegation()
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private totpService: TotpService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaClient,
  ) {}

  /**
   * Get cookie options based on environment
   *
   * Cookie secure flag logic:
   * - COOKIE_SECURE=true  → force secure (HTTPS required)
   * - COOKIE_SECURE=false → force non-secure (HTTP OK, for testing)
   * - Not set → auto-detect based on NODE_ENV (production=secure, dev=non-secure)
   */
  private getCookieOptions(path: string = '/', maxAge: number = 15 * 60 * 1000) {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const cookieDomain = this.configService.get<string>('COOKIE_DOMAIN');
    const cookieSecureEnv = this.configService.get<string>('COOKIE_SECURE');

    // Determine secure flag: explicit env var overrides auto-detection
    let isSecure: boolean;
    if (cookieSecureEnv !== undefined && cookieSecureEnv !== '') {
      isSecure = cookieSecureEnv === 'true';
    } else {
      isSecure = isProduction;
    }

    const options: Record<string, any> = {
      httpOnly: true,
      secure: isSecure,
      sameSite: (isSecure && cookieDomain) ? 'none' as const : 'lax' as const,
      maxAge,
      path,
    };

    // Only set domain for cross-origin deployments (e.g., .yourdomain.com)
    if (cookieDomain) {
      options.domain = cookieDomain;
    }

    return options;
  }

  @Post('login')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Login with email/password' })
  @ApiResponse({ status: 200, description: 'Returns user data and sets HTTP-only cookies, or requires 2FA' })
  async login(
    @Request() req: AuthRequest,
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = req.user;

    // Check tenant-level 2FA enforcement
    const tenant = await this.prisma.tenant.findUnique({ where: { id: user.tenantId } });
    const tenantConfig = (tenant?.config as Record<string, any>) || {};
    const require2FA = tenantConfig?.security?.require2FA === true;

    // Check if 2FA is enabled for this user OR required by tenant
    if (user.totpEnabled) {
      // Issue a short-lived temp token for 2FA verification
      const tempToken = this.jwtService.sign(
        { sub: user.id, type: '2fa_pending' },
        { expiresIn: '5m' },
      );
      return { requires2FA: true, tempToken };
    }

    // If tenant requires 2FA but user hasn't set it up, flag it
    if (require2FA && !user.totpEnabled) {
      const result = await this.authService.login(user);
      res.cookie('accessToken', result.accessToken, this.getCookieOptions('/', result.sessionMs));
      res.cookie('refreshToken', result.refreshToken, this.getCookieOptions('/api/auth/refresh', result.refreshMs));
      return { user: result.user, requires2FASetup: true };
    }

    const result = await this.authService.login(user);

    // Set HTTP-only cookies with tenant-configured timeouts
    res.cookie('accessToken', result.accessToken, this.getCookieOptions('/', result.sessionMs));
    res.cookie('refreshToken', result.refreshToken, this.getCookieOptions('/api/auth/refresh', result.refreshMs));

    // Return only user data (tokens already in cookies)
    return { user: result.user };
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current session status (checks accessToken cookie)' })
  @ApiResponse({ status: 200, description: 'Returns current user if authenticated' })
  @ApiResponse({ status: 401, description: 'Unauthorized - no valid session' })
  async getSession(@Request() req: AuthRequest) {
    // Enrich JWT data with full user info from DB (includes totpEnabled, name, tenant, etc.)
    const dbUser = await this.prisma.user.findUnique({
      where: { id: req.user.userId || req.user.id },
      include: { tenant: { select: { id: true, name: true, subdomain: true } } },
    });
    if (!dbUser) {
      throw new UnauthorizedException('User not found');
    }
    return {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        tenantId: dbUser.tenantId,
        tenant: dbUser.tenant,
        totpEnabled: dbUser.totpEnabled || false,
      },
      isAuthenticated: true,
    };
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Refresh access token using refreshToken cookie' })
  @ApiResponse({ status: 200, description: 'Sets new accessToken cookie' })
  @ApiResponse({ status: 401, description: 'Invalid or missing refresh token' })
  async refresh(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies['refreshToken'];

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const result = await this.authService.refreshAccessToken(refreshToken);

    // Set new accessToken cookie with tenant-configured timeout
    res.cookie('accessToken', result.accessToken, this.getCookieOptions('/', result.sessionMs));

    return { success: true };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout (clears authentication cookies)' })
  @ApiResponse({ status: 200, description: 'Cookies cleared successfully' })
  async logout(@Res({ passthrough: true }) res: Response) {
    // Clear authentication cookies (environment-aware)
    const accessCookieOpts = this.getCookieOptions('/', 0);
    const refreshCookieOpts = this.getCookieOptions('/api/auth/refresh', 0);

    res.clearCookie('accessToken', accessCookieOpts);
    res.clearCookie('refreshToken', refreshCookieOpts);

    return { success: true };
  }

  @Post('register')
  @RequireManage()
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Register new user (ADMIN only)' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@Request() req: AuthRequest) {
    return req.user;
  }

  // ===== TOTP 2FA Endpoints =====

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate TOTP secret and QR code for 2FA setup' })
  async setup2FA(@Request() req: AuthRequest) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || user.authProvider !== 'local') {
      throw new BadRequestException('2FA is only available for local accounts');
    }
    if (user.totpEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    const { secret, otpAuthUrl } = this.totpService.generateSecret(user.email);
    const qrCodeDataUrl = await this.totpService.generateQRCodeDataUrl(otpAuthUrl);

    // Store the secret temporarily (not enabled yet)
    await this.prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: secret },
    });

    return { secret, qrCodeDataUrl };
  }

  @Post('2fa/verify-setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify first TOTP code to complete 2FA setup' })
  async verifySetup2FA(
    @Request() req: AuthRequest,
    @Body() body: { token: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.totpSecret) {
      throw new BadRequestException('2FA setup not initiated');
    }
    if (user.totpEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    const isValid = this.totpService.verifyToken(user.totpSecret, body.token);
    if (!isValid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    // Generate backup codes
    const { codes, hashedCodes } = await this.totpService.generateBackupCodes();

    // Enable 2FA
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        totpEnabled: true,
        totpBackupCodes: hashedCodes,
      },
    });

    return { enabled: true, backupCodes: codes };
  }

  @Post('2fa/verify')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Verify TOTP code during login (uses temp token)' })
  async verify2FA(
    @Body() body: { code: string; tempToken: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    let payload: any;
    try {
      payload = this.jwtService.verify(body.tempToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired temp token');
    }

    if (payload.type !== '2fa_pending') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: true },
    });
    if (!user || !user.totpSecret || !user.totpEnabled) {
      throw new UnauthorizedException('2FA not configured');
    }

    const isValid = this.totpService.verifyToken(user.totpSecret, body.code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    // 2FA verified — issue real tokens with tenant-configured timeouts
    const result = await this.authService.login(user);
    res.cookie('accessToken', result.accessToken, this.getCookieOptions('/', result.sessionMs));
    res.cookie('refreshToken', result.refreshToken, this.getCookieOptions('/api/auth/refresh', result.refreshMs));

    return { user: result.user };
  }

  @Post('2fa/backup-verify')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Verify backup code during login (uses temp token)' })
  async verifyBackupCode(
    @Body() body: { code: string; tempToken: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    let payload: any;
    try {
      payload = this.jwtService.verify(body.tempToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired temp token');
    }

    if (payload.type !== '2fa_pending') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: true },
    });
    if (!user || !user.totpEnabled) {
      throw new UnauthorizedException('2FA not configured');
    }

    const { valid, remainingCodes } = await this.totpService.verifyBackupCode(
      body.code,
      user.totpBackupCodes,
    );

    if (!valid) {
      throw new UnauthorizedException('Invalid backup code');
    }

    // Update remaining backup codes
    await this.prisma.user.update({
      where: { id: user.id },
      data: { totpBackupCodes: remainingCodes },
    });

    // Issue real tokens with tenant-configured timeouts
    const result = await this.authService.login(user);
    res.cookie('accessToken', result.accessToken, this.getCookieOptions('/', result.sessionMs));
    res.cookie('refreshToken', result.refreshToken, this.getCookieOptions('/api/auth/refresh', result.refreshMs));

    return { user: result.user };
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable 2FA (requires current password)' })
  async disable2FA(
    @Request() req: AuthRequest,
    @Body() body: { password: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.totpEnabled) {
      throw new BadRequestException('2FA is not enabled');
    }

    // Verify password
    if (!user.passwordHash) {
      throw new BadRequestException('No password set');
    }
    const isPasswordValid = await bcrypt.compare(body.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        totpEnabled: false,
        totpSecret: null,
        totpBackupCodes: [],
      },
    });

    return { disabled: true };
  }

  @Delete('2fa/user/:userId')
  @RequireManage()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: disable 2FA for a specific user' })
  async adminDisable2FA(
    @Request() req: AuthRequest,
    @Param('userId') userId: string,
  ) {
    // Only ADMIN (local delegation role) or super admin can do this
    const localRole = (req as any).localRole;
    if (!req.user.isSuperAdmin && localRole !== 'ADMIN') {
      throw new UnauthorizedException('Admin access required');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpEnabled: false,
        totpSecret: null,
        totpBackupCodes: [],
      },
    });

    return { disabled: true };
  }

  // ===== Invite & Password Reset Endpoints =====

  @Post('invite')
  @RequireManage()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invite a new user by email (ADMIN/MANAGER)' })
  @ApiResponse({ status: 201, description: 'Invitation sent' })
  async invite(@Body() body: InviteUserDto, @Request() req: AuthRequest) {
    return this.authService.invite(req.user.tenantId, body.email, body.name);
  }

  @Post('accept-invite')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Accept invitation and set password (public)' })
  @ApiResponse({ status: 200, description: 'Account activated' })
  async acceptInvite(@Body() body: AcceptInviteDto) {
    return this.authService.acceptInvite(body.token, body.password);
  }

  @Post('forgot-password')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Request password reset email (public)' })
  @ApiResponse({ status: 200, description: 'Reset email sent if account exists' })
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Reset password using token (public)' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body.token, body.password);
  }

  // ===== SSO / OIDC Endpoints =====

  @Get('sso-config')
  @Public()
  @ApiOperation({ summary: 'Get SSO configuration status (public — for login page)' })
  @ApiResponse({ status: 200, description: 'SSO enabled status' })
  async getSsoConfig() {
    const oidcEnabled = this.configService.get('OIDC_ENABLED') === 'true';

    // Also check if there's a tenant-level SSO config
    let tenantSsoEnabled = false;
    try {
      const tenant = await this.prisma.tenant.findFirst({
        where: { status: 'ACTIVE' },
        select: { config: true },
      });
      const config = tenant?.config as Record<string, any> | null;
      tenantSsoEnabled = config?.sso?.enabled === true;
    } catch {
      // Ignore — no tenant configured yet
    }

    return {
      ssoEnabled: oidcEnabled || tenantSsoEnabled,
      provider: oidcEnabled ? 'oidc' : tenantSsoEnabled ? 'oidc' : null,
    };
  }

  @Get('oidc')
  @Public()
  @UseGuards(AuthGuard('oidc'))
  @ApiOperation({ summary: 'Initiate OIDC login flow (redirects to IdP)' })
  async oidcLogin() {
    // Passport handles the redirect automatically
  }

  @Get('oidc/callback')
  @Public()
  @UseGuards(AuthGuard('oidc'))
  @ApiOperation({ summary: 'OIDC callback handler (receives code from IdP)' })
  async oidcCallback(
    @Request() req: any,
    @Res() res: Response,
  ) {
    // The user is already authenticated via passport strategy
    const result = req.user;

    if (result?.accessToken) {
      // Set HTTP-only cookies
      res.cookie('accessToken', result.accessToken, this.getCookieOptions('/', 15 * 60 * 1000));
      res.cookie('refreshToken', result.refreshToken, this.getCookieOptions('/api/auth/refresh', 7 * 24 * 60 * 60 * 1000));
    }

    // Redirect to frontend dashboard
    const frontendUrl = this.configService.get('FRONTEND_URL') || '';
    res.redirect(frontendUrl ? `${frontendUrl}/dashboard` : '/dashboard');
  }
}
