import { Controller, Post, Body, UseGuards, Request, Get, Res, UnauthorizedException, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
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
  ) {}

  /**
   * Get cookie options based on environment
   * - Production: secure cookies with domain .eoncom.io
   * - Development/Test: localhost-compatible cookies
   */
  private getCookieOptions(path: string = '/', maxAge: number = 15 * 60 * 1000) {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const cookieDomain = this.configService.get<string>('COOKIE_DOMAIN') || '.eoncom.io';

    if (isProduction) {
      return {
        httpOnly: true,
        secure: true,
        sameSite: 'none' as const,
        domain: cookieDomain,
        maxAge,
        path,
      };
    }

    // Development/Test: localhost-compatible
    return {
      httpOnly: true,
      secure: false, // Allow HTTP in dev
      sameSite: 'lax' as const, // Lax works for localhost
      // No domain for localhost
      maxAge,
      path,
    };
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
}
