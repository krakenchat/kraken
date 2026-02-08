import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '@/database/database.service';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not set');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Primary: Authorization header
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // Fallback 1: Cookie (for same-origin browser requests)
        (req: Request): string | null => {
          const cookies = req?.cookies as Record<string, string> | undefined;
          return cookies?.access_token || null;
        },
        // Fallback 2: Query parameter (for embedded <img>, <video> tags in Electron/cross-origin)
        // This allows URLs like /api/file/123?token=<jwt> for embedded resources
        (req: Request): string | null => {
          const token = req?.query?.token;
          if (typeof token === 'string' && token.length > 0) {
            return token;
          }
          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: { sub: string; username: string }) {
    const user = await this.databaseService.user.findUniqueOrThrow({
      where: { id: payload.sub },
    });

    if (user.banned) {
      throw new UnauthorizedException('Account has been banned');
    }

    return user;
  }
}
