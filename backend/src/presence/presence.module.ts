import { Module } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { RedisModule } from '@/redis/redis.module';
import { PresenceGateway } from './presence.gateway';
import { AuthModule } from '@/auth/auth.module';
import { RolesModule } from '@/roles/roles.module';

@Module({
  providers: [PresenceService, PresenceGateway],
  imports: [RedisModule, AuthModule, RolesModule],
})
export class PresenceModule {}
