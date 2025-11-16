import {
  Controller,
  Post,
  UseGuards,
  HttpStatus,
  HttpCode,
  Req,
  Res,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { LocalAuthGuard } from './local-auth.guard';
import { AuthService } from './auth.service';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { DatabaseService } from '@/database/database.service';
import { AuthenticatedRequest } from '@/types';
import { setAccessTokenCookie, clearAccessTokenCookie } from './cookie-helper';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';
  constructor(
    private readonly authService: AuthService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Throttle({ short: { limit: 4, ttl: 1000 }, long: { limit: 10, ttl: 60000 } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const accessToken = this.authService.login(req.user);
    const refreshToken = await this.authService.generateRefreshToken(
      req.user.id,
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
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
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
      // Generate new token
      return this.authService.generateRefreshToken(user.id, tx);
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
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies[this.REFRESH_TOKEN_COOKIE_NAME] as
      | string
      | undefined;

    if (refreshToken) {
      await this.databaseService.$transaction(async (tx) => {
        const [user, jti] =
          await this.authService.verifyRefreshToken(refreshToken);

        if (user) {
          await this.authService.removeRefreshToken(jti, refreshToken, tx);
        }
      });

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
}
