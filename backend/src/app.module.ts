import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { RolesModule } from './roles/roles.module';
import { InviteModule } from './invite/invite.module';
import { CommunityModule } from './community/community.module';

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    InviteModule,
    ConfigModule.forRoot({ isGlobal: true }),
    RolesModule,
    UserModule,
    CommunityModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
