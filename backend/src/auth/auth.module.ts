import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UserModule } from '../user/user.module';
import { LocalStrategy } from './local.strategy';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { RolesModule } from '@/roles/roles.module';
import { DatabaseModule } from '@/database/database.module';
import { RbacGuard } from './rbac-roles.guard';

@Module({
  imports: [
    UserModule,
    RolesModule,
    PassportModule,
    DatabaseModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy, RbacGuard], // Add RbacGuard here
  exports: [AuthService, JwtStrategy, JwtModule, RbacGuard], // Ensure RbacGuard is exported
  controllers: [AuthController],
})
export class AuthModule {}
