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
import { UserEntity } from '@/user/dto/user-response.dto';
import { AuthService } from './auth.service';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { DatabaseService } from '@/database/database.service';

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
    @Req() req: { user: UserEntity },
    @Res({ passthrough: true }) res: Response,
  ) {
    const accessToken = this.authService.login(req.user);
    const refreshToken = await this.authService.generateRefreshToken(
      req.user.id,
    );

    this.setRefreshCookie(res, refreshToken);

    return { accessToken };
  }

  @Throttle({ short: { limit: 4, ttl: 1000 }, long: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies[this.REFRESH_TOKEN_COOKIE_NAME] as
      | string
      | undefined;

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

    this.setRefreshCookie(res, token);

    return { accessToken: this.authService.login(user) };
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
