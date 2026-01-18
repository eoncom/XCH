import { Controller, Post, Body, UseGuards, Request, Get, Res, UnauthorizedException, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
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
  constructor(private authService: AuthService) {}

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

    // Set HTTP-only cookies (secure authentication)
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true, // ✅ Protection XSS - not accessible via JavaScript
      secure: true, // ✅ HTTPS enforced (Nginx Proxy Manager with SSL)
      sameSite: 'none', // ✅ Allow cross-subdomain (xch.domain.com ↔ api.xch.domain.com)
      domain: '.eoncom.io', // ✅ Share cookie across all subdomains (xch.eoncom.io, xchapi.eoncom.io)
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: true, // ✅ HTTPS enforced
      sameSite: 'none', // ✅ Cross-subdomain
      domain: '.eoncom.io', // ✅ Share cookie across all subdomains
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth/refresh', // ✅ Restrict cookie to refresh endpoint only
    });

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

    // Set new accessToken cookie
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      domain: '.eoncom.io', // ✅ Share cookie across all subdomains
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });

    return { success: true };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout (clears authentication cookies)' })
  @ApiResponse({ status: 200, description: 'Cookies cleared successfully' })
  async logout(@Res({ passthrough: true }) res: Response) {
    // Clear authentication cookies
    res.clearCookie('accessToken', { path: '/', domain: '.eoncom.io', secure: true, sameSite: 'none' });
    res.clearCookie('refreshToken', { path: '/api/auth/refresh', domain: '.eoncom.io', secure: true, sameSite: 'none' });

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
