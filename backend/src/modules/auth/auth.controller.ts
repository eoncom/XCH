import { Controller, Post, Body, UseGuards, Request, Get, Res, UnauthorizedException, Req, Delete, Param, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { Response, Request as ExpressRequest } from 'express';
import * as bcrypt from 'bcrypt';
import { Throttle } from '@nestjs/throttler';

/**
 * Env-tunable throttle limits so ops can loosen them during test phases
 * without redeploying DDL. All have prod-safe defaults.
 *   THROTTLE_AUTH_LIMIT        (default 5)   — login/2FA/invite
 *   THROTTLE_AUTH_LOGOUT_LIMIT (default 10)  — logout (higher to allow quick bounces)
 *   THROTTLE_AUTH_FORGOT_LIMIT (default 3)   — forgot-password (low to deter abuse)
 */
const authLimit = parseInt(process.env.THROTTLE_AUTH_LIMIT || '5', 10);
const authLogoutLimit = parseInt(process.env.THROTTLE_AUTH_LOGOUT_LIMIT || '10', 10);
const authForgotLimit = parseInt(process.env.THROTTLE_AUTH_FORGOT_LIMIT || '3', 10);
import { AuthService } from './auth.service';
import { TotpService } from './totp.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LoginResponseDto } from './dto/login.response.dto';
import { SessionResponseDto } from './dto/session.response.dto';
import { AuthProfileResponseDto } from './dto/auth-profile.response.dto';
import { AuthUserResponseDto } from './dto/auth-user.response.dto';
import { MyPermissionsResponseDto } from './dto/auth-permissions.response.dto';
import { TotpSetupResponseDto } from './dto/totp-setup.response.dto';
import { TotpVerifySetupResponseDto } from './dto/totp-verify-setup.response.dto';
import { SsoConfigResponseDto } from './dto/sso-config.response.dto';
import { InviteResponseDto } from './dto/invite.response.dto';
import {
  AuthSuccessResultResponseDto,
  TotpDisabledResultResponseDto,
  AuthMessageResultResponseDto,
} from './dto/auth-action-result.response.dto';
import { toResponse } from '../../common/utils/to-response.util';
import { AuthRequest } from '../../types/request.interface';
import { SkipDelegation } from '../../common/decorators/skip-delegation.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequireManage } from '../../common/decorators/require-right.decorator';
import { PermissionService } from '../../common/services/permission.service';
import { CryptoService } from '../../common/crypto/crypto.service';

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
    private permissionService: PermissionService,
    private crypto: CryptoService,
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
  @Throttle({ default: { ttl: 60000, limit: authLimit } })
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Login with email/password' })
  @ApiOkResponse({
    type: LoginResponseDto,
    description: 'Returns one of three shapes: { user } success, { requires2FA, tempToken } 2FA gate, or { user, requires2FASetup } when tenant requires enrollment. Sets HTTP-only cookies on success paths.',
  })
  async login(
    @Request() req: AuthRequest,
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const user = req.user;

    // ADR-018 — TenantSecurityConfig (typed) replaces tenant.config.security.
    const securityConfig = await this.prisma.tenantSecurityConfig.findUnique({
      where: { tenantId: user.tenantId },
    });
    const require2FA = securityConfig?.require2FA === true;

    // Check if 2FA is enabled for this user OR required by tenant
    if (user.totpEnabled) {
      // Issue a short-lived temp token for 2FA verification
      const tempToken = this.jwtService.sign(
        { sub: user.id, type: '2fa_pending' },
        { expiresIn: '5m' },
      );
      return toResponse(LoginResponseDto, { requires2FA: true, tempToken });
    }

    // If tenant requires 2FA but user hasn't set it up, flag it
    if (require2FA && !user.totpEnabled) {
      const result = await this.authService.login(user);
      res.cookie('accessToken', result.accessToken, this.getCookieOptions('/', result.sessionMs));
      res.cookie('refreshToken', result.refreshToken, this.getCookieOptions('/api/auth/refresh', result.refreshMs));
      return toResponse(LoginResponseDto, { user: result.user, requires2FASetup: true });
    }

    const result = await this.authService.login(user);

    // Set HTTP-only cookies with tenant-configured timeouts
    res.cookie('accessToken', result.accessToken, this.getCookieOptions('/', result.sessionMs));
    res.cookie('refreshToken', result.refreshToken, this.getCookieOptions('/api/auth/refresh', result.refreshMs));

    // Return only user data (tokens already in cookies)
    return toResponse(LoginResponseDto, { user: result.user });
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current session status (checks accessToken cookie)' })
  @ApiOkResponse({ type: SessionResponseDto, description: 'Returns the authenticated user enriched with tenant ref' })
  async getSession(@Request() req: AuthRequest): Promise<SessionResponseDto> {
    // Enrich JWT data with full user info from DB (includes totpEnabled, name, tenant, etc.)
    const dbUser = await this.prisma.user.findUnique({
      where: { id: req.user.userId || req.user.id },
      include: { tenant: { select: { id: true, name: true, subdomain: true } } },
    });
    if (!dbUser) {
      throw new UnauthorizedException('User not found');
    }
    return toResponse(SessionResponseDto, {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        tenantId: dbUser.tenantId,
        tenant: dbUser.tenant,
        totpEnabled: dbUser.totpEnabled || false,
        isSuperAdmin: dbUser.isSuperAdmin || false,
      },
      isAuthenticated: true,
    });
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Refresh access token using refreshToken cookie' })
  @ApiOkResponse({ type: AuthSuccessResultResponseDto, description: 'Sets new accessToken cookie' })
  async refresh(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSuccessResultResponseDto> {
    const refreshToken = req.cookies['refreshToken'];

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const result = await this.authService.refreshAccessToken(refreshToken);

    // Set new accessToken cookie with tenant-configured timeout
    res.cookie('accessToken', result.accessToken, this.getCookieOptions('/', result.sessionMs));

    return toResponse(AuthSuccessResultResponseDto, { success: true });
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout (clears authentication cookies)' })
  @ApiOkResponse({ type: AuthSuccessResultResponseDto, description: 'Cookies cleared successfully' })
  async logout(@Res({ passthrough: true }) res: Response): Promise<AuthSuccessResultResponseDto> {
    // Clear authentication cookies (environment-aware)
    const accessCookieOpts = this.getCookieOptions('/', 0);
    const refreshCookieOpts = this.getCookieOptions('/api/auth/refresh', 0);

    res.clearCookie('accessToken', accessCookieOpts);
    res.clearCookie('refreshToken', refreshCookieOpts);

    return toResponse(AuthSuccessResultResponseDto, { success: true });
  }

  @Post('register')
  @RequireManage()
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60000, limit: authLimit } })
  @ApiOperation({ summary: 'Register new user (ADMIN only)' })
  @ApiCreatedResponse({ type: AuthUserResponseDto, description: 'Created user (sensitive fields stripped)' })
  async register(@Body() registerDto: RegisterDto): Promise<AuthUserResponseDto> {
    const created = await this.authService.register(registerDto);
    return toResponse(AuthUserResponseDto, created);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ type: AuthProfileResponseDto, description: 'JWT-payload-derived caller identity' })
  getProfile(@Request() req: AuthRequest): AuthProfileResponseDto {
    return toResponse(AuthProfileResponseDto, req.user);
  }

  @Get('my-permissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user permissions summary' })
  @ApiOkResponse({ type: MyPermissionsResponseDto, description: 'Composite of super-admin flag, delegations, and accessible site IDs' })
  async getMyPermissions(@Request() req: AuthRequest): Promise<MyPermissionsResponseDto> {
    const userId = req.user.userId || req.user.id;
    const tenantId = req.user.tenantId;

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { isSuperAdmin: true },
    });

    const delegations = await this.prisma.userDelegation.findMany({
      where: { tenantId, userId },
      include: {
        delegation: { select: { id: true, name: true, code: true, groupLabel: true, groupColor: true } },
      },
    });

    const hasDelegation = delegations.length > 0;
    const isSuperAdmin = user?.isSuperAdmin ?? false;

    const accessibleSiteIds = await this.permissionService.getAccessibleSiteIds(tenantId, userId);

    return toResponse(MyPermissionsResponseDto, {
      isSuperAdmin,
      hasDelegation,
      allSitesAccess: isSuperAdmin || accessibleSiteIds === null,
      accessibleSiteIds,
      delegations,
    });
  }

  // ===== TOTP 2FA Endpoints =====

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate TOTP secret and QR code for 2FA setup' })
  @ApiOkResponse({ type: TotpSetupResponseDto, description: 'Plaintext TOTP secret + QR data URL — user enrolls in their authenticator app' })
  async setup2FA(@Request() req: AuthRequest): Promise<TotpSetupResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || user.authProvider !== 'local') {
      throw new BadRequestException('2FA is only available for local accounts');
    }
    if (user.totpEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    const { secret, otpAuthUrl } = this.totpService.generateSecret(user.email);
    const qrCodeDataUrl = await this.totpService.generateQRCodeDataUrl(otpAuthUrl);

    // ADR-019 — totpSecret persisted encrypted-at-rest. The plaintext is
    // returned to the caller (the user enters it into their authenticator
    // app or scans the QR), but never lands on disk in clear.
    await this.prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: this.crypto.encryptIfPlain(secret) },
    });

    return toResponse(TotpSetupResponseDto, { secret, qrCodeDataUrl });
  }

  @Post('2fa/verify-setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify first TOTP code to complete 2FA setup' })
  @ApiOkResponse({ type: TotpVerifySetupResponseDto, description: 'Plaintext backup codes returned ONCE — user must save them out-of-band' })
  async verifySetup2FA(
    @Request() req: AuthRequest,
    @Body() body: { token: string },
  ): Promise<TotpVerifySetupResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.totpSecret) {
      throw new BadRequestException('2FA setup not initiated');
    }
    if (user.totpEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    // ADR-019 — totpSecret stored as v1:… envelope. Decrypt before TOTP verify.
    const plainSecret = this.crypto.decryptOrLegacy(user.totpSecret);
    if (!plainSecret) {
      throw new BadRequestException('2FA setup state corrupted — please restart');
    }
    const isValid = this.totpService.verifyToken(plainSecret, body.token);
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

    return toResponse(TotpVerifySetupResponseDto, { enabled: true, backupCodes: codes });
  }

  @Post('2fa/verify')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: authLimit } })
  @ApiOperation({ summary: 'Verify TOTP code during login (uses temp token)' })
  @ApiOkResponse({ type: LoginResponseDto, description: 'Returns { user } on success and sets HTTP-only cookies' })
  async verify2FA(
    @Body() body: { code: string; tempToken: string },
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
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

    // ADR-019 — decrypt before TOTP verify.
    const plainSecret = this.crypto.decryptOrLegacy(user.totpSecret);
    if (!plainSecret) {
      throw new UnauthorizedException('2FA secret unreadable');
    }
    const isValid = this.totpService.verifyToken(plainSecret, body.code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    // 2FA verified — issue real tokens with tenant-configured timeouts
    const result = await this.authService.login(user);
    res.cookie('accessToken', result.accessToken, this.getCookieOptions('/', result.sessionMs));
    res.cookie('refreshToken', result.refreshToken, this.getCookieOptions('/api/auth/refresh', result.refreshMs));

    return toResponse(LoginResponseDto, { user: result.user });
  }

  @Post('2fa/backup-verify')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: authLimit } })
  @ApiOperation({ summary: 'Verify backup code during login (uses temp token)' })
  @ApiOkResponse({ type: LoginResponseDto, description: 'Returns { user } on success and sets HTTP-only cookies' })
  async verifyBackupCode(
    @Body() body: { code: string; tempToken: string },
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
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

    return toResponse(LoginResponseDto, { user: result.user });
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable 2FA (requires current password)' })
  @ApiOkResponse({ type: TotpDisabledResultResponseDto, description: 'TOTP disabled and backup codes wiped' })
  async disable2FA(
    @Request() req: AuthRequest,
    @Body() body: { password: string },
  ): Promise<TotpDisabledResultResponseDto> {
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

    return toResponse(TotpDisabledResultResponseDto, { disabled: true });
  }

  @Delete('2fa/user/:userId')
  @RequireManage()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: disable 2FA for a specific user (super admin only via class-level @SkipDelegation + @RequireManage)' })
  @ApiOkResponse({ type: TotpDisabledResultResponseDto, description: 'TOTP disabled for the target user' })
  async adminDisable2FA(
    @Request() req: AuthRequest,
    @Param('userId') userId: string,
  ): Promise<TotpDisabledResultResponseDto> {
    // Authorization already enforced by PermissionGuard:
    //   class-level @SkipDelegation + method @RequireManage → isSuperAdmin only.
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpEnabled: false,
        totpSecret: null,
        totpBackupCodes: [],
      },
    });

    return toResponse(TotpDisabledResultResponseDto, { disabled: true });
  }

  // ===== Invite & Password Reset Endpoints =====

  @Post('invite')
  @RequireManage()
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Invite a new user by email. Class-level @SkipDelegation() + @RequireManage() resolves to super-admin only (see AUTH_MODEL §4 table). Delegation-scoped MANAGE users create members via POST /users instead.',
  })
  @ApiCreatedResponse({
    type: InviteResponseDto,
    description: 'Created user + emailSent flag. Plaintext inviteToken returned only when SMTP failed (admin shares the link manually).',
  })
  async invite(@Body() body: InviteUserDto, @Request() req: AuthRequest): Promise<InviteResponseDto> {
    const created = await this.authService.invite(req.user.tenantId, body.email, body.name);
    return toResponse(InviteResponseDto, created);
  }

  @Post('accept-invite')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: authLogoutLimit } })
  @ApiOperation({ summary: 'Accept invitation and set password (public)' })
  @ApiOkResponse({ type: AuthMessageResultResponseDto, description: 'Account activated' })
  async acceptInvite(@Body() body: AcceptInviteDto): Promise<AuthMessageResultResponseDto> {
    const result = await this.authService.acceptInvite(body.token, body.password);
    return toResponse(AuthMessageResultResponseDto, result);
  }

  @Post('forgot-password')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: authForgotLimit } })
  @ApiOperation({ summary: 'Request password reset email (public)' })
  @ApiOkResponse({ type: AuthMessageResultResponseDto, description: 'Reset email sent if account exists (response is identical regardless to avoid user-existence oracle)' })
  async forgotPassword(@Body() body: ForgotPasswordDto): Promise<AuthMessageResultResponseDto> {
    const result = await this.authService.forgotPassword(body.email);
    return toResponse(AuthMessageResultResponseDto, result);
  }

  @Post('reset-password')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: authLimit } })
  @ApiOperation({ summary: 'Reset password using token (public)' })
  @ApiOkResponse({ type: AuthMessageResultResponseDto, description: 'Password reset successfully' })
  async resetPassword(@Body() body: ResetPasswordDto): Promise<AuthMessageResultResponseDto> {
    const result = await this.authService.resetPassword(body.token, body.password);
    return toResponse(AuthMessageResultResponseDto, result);
  }

  // ===== SSO / OIDC Endpoints =====

  @Get('sso-config')
  @Public()
  @ApiOperation({ summary: 'Get SSO configuration status (public — for login page)' })
  @ApiOkResponse({ type: SsoConfigResponseDto, description: 'SSO enabled status and provider identifier' })
  async getSsoConfig(): Promise<SsoConfigResponseDto> {
    const oidcEnabled = this.configService.get('OIDC_ENABLED') === 'true';

    // ADR-018 — TenantSsoConfig (typed table) replaces tenant.config.sso.
    let tenantSsoEnabled = false;
    try {
      const tenant = await this.prisma.tenant.findFirst({
        where: { status: 'ACTIVE' },
        include: { ssoConfig: true },
      });
      tenantSsoEnabled = tenant?.ssoConfig?.enabled === true;
    } catch {
      // Ignore — no tenant configured yet
    }

    return toResponse(SsoConfigResponseDto, {
      ssoEnabled: oidcEnabled || tenantSsoEnabled,
      provider: oidcEnabled ? 'oidc' : tenantSsoEnabled ? 'oidc' : null,
    });
  }

  @Get('oidc')
  @Public()
  @UseGuards(AuthGuard('oidc'))
  @ApiOperation({ summary: 'Initiate OIDC login flow (redirects to IdP)' })
  @ApiOkResponse({ description: 'Redirects to the configured IdP — no JSON body returned' })
  async oidcLogin(@Res() _res: Response) {
    // Passport handles the redirect automatically via the AuthGuard('oidc') strategy.
  }

  @Get('oidc/callback')
  @Public()
  @UseGuards(AuthGuard('oidc'))
  @ApiOperation({ summary: 'OIDC callback handler (receives code from IdP)' })
  @ApiOkResponse({ description: 'Sets HTTP-only cookies and redirects to the frontend dashboard — no JSON body returned' })
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
