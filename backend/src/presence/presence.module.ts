import { Module } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { PresenceController } from './presence.controller';
import { RedisModule } from '@/redis/redis.module';
import { PresenceGateway } from './presence.gateway';
import { AuthModule } from '@/auth/auth.module';
import { RolesModule } from '@/roles/roles.module';
import { UserModule } from '@/user/user.module';

@Module({
  controllers: [PresenceController],
  providers: [PresenceService, PresenceGateway],
  imports: [RedisModule, AuthModule, RolesModule, UserModule],
  exports: [PresenceService],
})
export class PresenceModule {}
