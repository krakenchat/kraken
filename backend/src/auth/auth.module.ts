import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UserModule } from '../user/user.module';
import { LocalStrategy } from './local.strategy';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { TokenBlacklistService } from './token-blacklist.service';
import { RolesModule } from '@/roles/roles.module';
import { DatabaseModule } from '@/database/database.module';
import { RedisModule } from '@/redis/redis.module';
import { RbacGuard } from './rbac.guard';
import { WsJwtAuthGuard } from './ws-jwt-auth.guard';

@Module({
  imports: [
    UserModule,
    RolesModule,
    PassportModule,
    DatabaseModule,
    RedisModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    TokenBlacklistService,
    RbacGuard,
    WsJwtAuthGuard,
  ],
  exports: [
    AuthService,
    JwtStrategy,
    JwtModule,
    TokenBlacklistService,
    RbacGuard,
    WsJwtAuthGuard,
  ],
  controllers: [AuthController],
})
export class AuthModule {}
