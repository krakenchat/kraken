import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '@/user/dto/user-response.dto';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '@/database/database.service';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ObjectId } from 'mongodb';

@Injectable()
export class AuthService {
  private readonly jwtRefreshSecret: string | undefined;
  private readonly logger = new Logger(AuthService.name);
  // Dummy hash for timing-attack prevention - bcrypt.compare() must always run
  private readonly DUMMY_HASH =
    '$2b$10$dummyhashfortimingattackprevention000000000000000';
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

  async verifyRefreshToken(
    refreshToken: string,
  ): Promise<[UserEntity, string]> {
    const payload = await this.jwtService.verifyAsync<{
      sub: string;
      jti: string;
    }>(refreshToken, {
      secret: this.jwtRefreshSecret,
      ignoreExpiration: false,
    });

    if (!payload) {
      throw new UnauthorizedException('Could not verify refresh token');
    }

    const user = await this.userService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Could not find user');
    }

    return [new UserEntity(user), payload.jti];
  }

  async generateRefreshToken(userId: string, tx?: Prisma.TransactionClient) {
    // generate a MongoDB ObjectId for the jti
    const jti = new ObjectId().toHexString();
    const refreshToken = this.jwtService.sign(
      { sub: userId, jti },
      {
        secret: this.jwtRefreshSecret,
        expiresIn: '30d',
      },
    );

    const hashed = await bcrypt.hash(refreshToken, 10);
    const client = tx ?? this.databaseService;
    await client.refreshToken.create({
      data: {
        id: jti,
        userId,
        tokenHash: hashed,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    return refreshToken;
  }

  async removeRefreshToken(
    jti: string,
    refreshToken: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.databaseService;
    const token = await this.findMatchingToken(jti, refreshToken, tx);

    if (!token) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await client.refreshToken.delete({
      where: { id: token.id },
    });
  }

  async validateRefreshToken(
    jti: string,
    refreshToken: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string | null> {
    const token = await this.findMatchingToken(jti, refreshToken, tx);
    if (token && token.expiresAt > new Date()) {
      return token.id;
    }

    return null;
  }

  private async findMatchingToken(
    jti: string,
    refreshToken: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.databaseService;
    const token = await client.refreshToken.findUnique({
      where: { id: jti },
    });

    // Always run bcrypt.compare() to prevent timing attacks
    // If token doesn't exist, compare against dummy hash to maintain consistent timing
    const isMatch = await bcrypt.compare(
      refreshToken,
      token?.tokenHash ?? this.DUMMY_HASH,
    );

    if (isMatch && token) {
      return token;
    }

    return null;
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
