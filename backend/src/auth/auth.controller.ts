import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
  Req,
  Res,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService, DeviceInfo } from './auth.service';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { DatabaseService } from '@/database/database.service';
import { AuthenticatedRequest } from '@/types';
import { setAccessTokenCookie, clearAccessTokenCookie } from './cookie-helper';
import { ParseObjectIdPipe } from 'nestjs-object-id';
import {
  LoginResponseDto,
  LogoutResponseDto,
  SessionInfoDto,
  RevokeSessionResponseDto,
  RevokeAllSessionsResponseDto,
} from './dto/auth-response.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';
  constructor(
    private readonly authService: AuthService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Extract device info from request headers
   */
  private getDeviceInfo(req: Request): DeviceInfo {
    const userAgent = req.headers['user-agent'] || '';
    // Get IP address (handle proxies)
    const forwarded = req.headers['x-forwarded-for'];
    const ipAddress =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]) ||
      req.socket?.remoteAddress ||
      '';

    return { userAgent, ipAddress };
  }

  @Throttle({ short: { limit: 4, ttl: 1000 }, long: { limit: 10, ttl: 60000 } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LoginResponseDto })
  async login(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const deviceInfo = this.getDeviceInfo(req);
    const accessToken = this.authService.login(req.user);
    const refreshToken = await this.authService.generateRefreshToken(
      req.user.id,
      deviceInfo,
    );

    // Always set cookies for web clients (access token for browser media, refresh for sessions)
    setAccessTokenCookie(res, accessToken);
    this.setRefreshCookie(res, refreshToken);

    // Check if this is an Electron client
    const userAgent = req.headers['user-agent'] || '';
    const isElectron = userAgent.includes('Electron');

    // Return refresh token in body for Electron clients
    if (isElectron) {
      return { accessToken, refreshToken };
    }

    return { accessToken };
  }

  @Throttle({ short: { limit: 4, ttl: 1000 }, long: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LoginResponseDto })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    // Check if this is an Electron client
    const userAgent = req.headers['user-agent'] || '';
    const isElectron = userAgent.includes('Electron');

    // Get refresh token from cookie or body (for Electron)
    let refreshToken = req.cookies[this.REFRESH_TOKEN_COOKIE_NAME] as
      | string
      | undefined;

    // For Electron, also check the request body
    const body = req.body as { refreshToken?: string } | undefined;
    if (!refreshToken && isElectron && body?.refreshToken) {
      refreshToken = body.refreshToken;
    }

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const [user, jti] = await this.authService.verifyRefreshToken(refreshToken);
    const deviceInfo = this.getDeviceInfo(req);

    // Do this in a tx so we don't have dangling refresh tokens or something weird
    const token = await this.databaseService.$transaction(async (tx) => {
      const tokenId = await this.authService.validateRefreshToken(
        jti,
        refreshToken,
        tx,
      );

      if (!tokenId) {
        this.logger.error('Could not find token by id');
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Delete old token
      await this.authService.removeRefreshToken(jti, refreshToken, tx);
      // Generate new token with device info
      return this.authService.generateRefreshToken(user.id, deviceInfo, tx);
    });

    const newAccessToken = this.authService.login(user);

    // Always set cookies for web clients
    setAccessTokenCookie(res, newAccessToken);
    this.setRefreshCookie(res, token);

    // Return new refresh token in body for Electron clients
    if (isElectron) {
      return { accessToken: newAccessToken, refreshToken: token };
    }

    return { accessToken: newAccessToken };
  }

  @Throttle({ short: { limit: 2, ttl: 1000 }, long: { limit: 5, ttl: 60000 } })
  @Post('logout')
  @ApiCreatedResponse({ type: LogoutResponseDto })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LogoutResponseDto> {
    const refreshToken = req.cookies[this.REFRESH_TOKEN_COOKIE_NAME] as
      | string
      | undefined;

    if (refreshToken) {
      try {
        await this.databaseService.$transaction(async (tx) => {
          const [user, jti] =
            await this.authService.verifyRefreshToken(refreshToken);

          if (user) {
            await this.authService.removeRefreshToken(jti, refreshToken, tx);
          }
        });
      } catch {
        // Token may be expired or invalid — still clear the cookie
        this.logger.debug(
          'Failed to verify refresh token during logout, clearing cookie anyway',
        );
      }

      res.clearCookie(this.REFRESH_TOKEN_COOKIE_NAME);
    }

    // Always clear access token cookie on logout
    clearAccessTokenCookie(res);

    return { message: 'Logged out successfully' };
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie(this.REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      sameSite: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    });
  }

  /**
   * Get current token ID from request (for marking current session)
   */
  private async getCurrentTokenId(req: Request): Promise<string | undefined> {
    const refreshToken = req.cookies[this.REFRESH_TOKEN_COOKIE_NAME] as
      | string
      | undefined;

    if (!refreshToken) {
      return undefined;
    }

    try {
      const [, jti] = await this.authService.verifyRefreshToken(refreshToken);
      return jti;
    } catch {
      return undefined;
    }
  }

  /**
   * Get all active sessions for the current user
   */
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  @ApiOkResponse({ type: [SessionInfoDto] })
  async getSessions(
    @Req() req: AuthenticatedRequest,
  ): Promise<SessionInfoDto[]> {
    const currentTokenId = await this.getCurrentTokenId(req);
    return this.authService.getUserSessions(req.user.id, currentTokenId);
  }

  /**
   * Revoke a specific session
   */
  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:sessionId')
  @ApiOkResponse({ type: RevokeSessionResponseDto })
  async revokeSession(
    @Req() req: AuthenticatedRequest,
    @Param('sessionId', ParseObjectIdPipe) sessionId: string,
  ): Promise<RevokeSessionResponseDto> {
    const revoked = await this.authService.revokeSession(
      req.user.id,
      sessionId,
    );

    if (!revoked) {
      throw new NotFoundException('Session not found');
    }

    return { message: 'Session revoked successfully' };
  }

  /**
   * Revoke all sessions except the current one
   */
  @UseGuards(JwtAuthGuard)
  @Delete('sessions')
  @ApiOkResponse({ type: RevokeAllSessionsResponseDto })
  async revokeAllOtherSessions(
    @Req() req: AuthenticatedRequest,
  ): Promise<RevokeAllSessionsResponseDto> {
    const currentTokenId = await this.getCurrentTokenId(req);

    if (!currentTokenId) {
      throw new UnauthorizedException('Could not determine current session');
    }

    const count = await this.authService.revokeAllOtherSessions(
      req.user.id,
      currentTokenId,
    );

    return {
      message: `Revoked ${count} session${count !== 1 ? 's' : ''}`,
      revokedCount: count,
    };
  }
}
