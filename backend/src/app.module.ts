import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { RolesModule } from './roles/roles.module';
import { InviteModule } from './invite/invite.module';

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    InviteModule,
    ConfigModule.forRoot({ isGlobal: true }),
    RolesModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
