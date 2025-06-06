import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { LivekitService } from './livekit.service';
import { LivekitController } from './livekit.controller';
import { UserModule } from '@/user/user.module';
import { RolesModule } from '@/roles/roles.module';

@Module({
  imports: [ConfigModule, AuthModule, UserModule, RolesModule],
  controllers: [LivekitController],
  providers: [LivekitService],
  exports: [LivekitService],
})
export class LivekitModule {}
