import { Controller, Post, Body, UseGuards, Request, Get, Res, UnauthorizedException, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { Response, Request as ExpressRequest } from 'express';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
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
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Login with email/password' })
  @ApiResponse({ status: 200, description: 'Returns user data and sets HTTP-only cookies (accessToken, refreshToken)' })
  async login(
    @Request() req: AuthRequest,
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(req.user);

    // Set HTTP-only cookies (environment-aware)
    res.cookie('accessToken', result.accessToken, this.getCookieOptions('/', 15 * 60 * 1000));
    res.cookie('refreshToken', result.refreshToken, this.getCookieOptions('/api/auth/refresh', 7 * 24 * 60 * 60 * 1000));

    // Return only user data (tokens already in cookies)
    return { user: result.user };
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current session status (checks accessToken cookie)' })
  @ApiResponse({ status: 200, description: 'Returns current user if authenticated' })
  @ApiResponse({ status: 401, description: 'Unauthorized - no valid session' })
  getSession(@Request() req: AuthRequest) {
    return {
      user: req.user,
      isAuthenticated: true,
    };
  }

  @Post('refresh')
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

    // Set new accessToken cookie (environment-aware)
    res.cookie('accessToken', result.accessToken, this.getCookieOptions('/', 15 * 60 * 1000));

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
  @ApiOperation({ summary: 'Register new user' })
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

  // ===== SSO / OIDC Endpoints =====

  @Get('sso-config')
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
  @UseGuards(AuthGuard('oidc'))
  @ApiOperation({ summary: 'Initiate OIDC login flow (redirects to IdP)' })
  async oidcLogin() {
    // Passport handles the redirect automatically
  }

  @Get('oidc/callback')
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
