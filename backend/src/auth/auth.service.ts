import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import { UserEntity } from 'src/user/dto/user-response.dto';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '@/database/database.service';
import { ConfigService } from '@nestjs/config';
import { Prisma, RefreshToken } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class AuthService {
  private readonly jwtRefreshSecret: string | undefined;
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly databaseService: DatabaseService,
    configService: ConfigService,
  ) {
    this.jwtRefreshSecret = configService.get<string>('JWT_REFRESH_SECRET');
    if (!this.jwtRefreshSecret) {
      throw new Error('JWT_REFRESH_SECRET not set');
    }
  }

  async validateUser(
    username: string,
    pass: string,
  ): Promise<UserEntity | null> {
    const user = await this.userService.findByUsername(
      username.toLocaleLowerCase(),
    );
    if (user && (await bcrypt.compare(pass, user.hashedPassword))) {
      return new UserEntity(user);
    }

    return null;
  }

  login(user: UserEntity) {
    const payload = { username: user.username, sub: user.id, role: user.role };
    return this.jwtService.sign(payload);
  }

  async verifyRefreshToken(refreshToken: string) {
    const payload = await this.jwtService.verifyAsync<{ sub: string }>(
      refreshToken,
      {
        secret: this.jwtRefreshSecret,
        ignoreExpiration: false,
      },
    );

    if (!payload) {
      return null;
    }

    const user = await this.userService.findById(payload.sub);

    if (!user) {
      return null;
    }

    return user;
  }

  async generateRefreshToken(userId: string, tx?: Prisma.TransactionClient) {
    const refreshToken = this.jwtService.sign(
      { sub: userId },
      {
        secret: this.jwtRefreshSecret,
        expiresIn: '30d',
      },
    );

    const hashed = await bcrypt.hash(refreshToken, 10);
    const client = tx ?? this.databaseService;
    await client.refreshToken.create({
      data: {
        userId,
        tokenHash: hashed,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    return refreshToken;
  }

  async removeRefreshToken(
    userId: string,
    refreshToken: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.databaseService;
    for await (const token of this.findMatchingTokens(
      userId,
      refreshToken,
      tx,
    )) {
      await client.refreshToken.delete({
        where: { id: token.id },
      });
    }
  }

  async validateRefreshToken(
    userId: string,
    refreshToken: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string | null> {
    for await (const token of this.findMatchingTokens(
      userId,
      refreshToken,
      tx,
    )) {
      if (token.expiresAt > new Date()) {
        return token.id;
      }
    }

    return null;
  }

  private async *findMatchingTokens(
    userId: string,
    refreshToken: string,
    tx?: Prisma.TransactionClient,
  ): AsyncGenerator<RefreshToken> {
    const client = tx ?? this.databaseService;
    const tokens = await client.refreshToken.findMany({
      where: { userId },
    });

    for (const token of tokens) {
      const isMatch = await bcrypt.compare(refreshToken, token.tokenHash);
      if (isMatch) {
        yield token;
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async cleanExpiredTokens() {
    const expiredTokens = await this.databaseService.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    this.logger.log(
      `Cleaned up ${expiredTokens.count} expired refresh tokens from the database.`,
    );
  }
}
