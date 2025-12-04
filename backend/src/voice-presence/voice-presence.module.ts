import { Module, forwardRef } from '@nestjs/common';
import { VoicePresenceService } from './voice-presence.service';
import {
  VoicePresenceController,
  UserVoicePresenceController,
  DmVoicePresenceController,
} from './voice-presence.controller';
import { VoicePresenceGateway } from './voice-presence.gateway';
import { RedisModule } from '@/redis/redis.module';
import { WebsocketModule } from '@/websocket/websocket.module';
import { AuthModule } from '@/auth/auth.module';
import { UserModule } from '@/user/user.module';
import { RolesModule } from '@/roles/roles.module';
import { DatabaseModule } from '@/database/database.module';
import { LivekitModule } from '@/livekit/livekit.module';

@Module({
  imports: [
    RedisModule,
    WebsocketModule,
    AuthModule,
    UserModule,
    RolesModule,
    DatabaseModule,
    // Use forwardRef to handle circular dependency (LivekitModule imports VoicePresenceModule)
    forwardRef(() => LivekitModule),
  ],
  controllers: [
    VoicePresenceController,
    UserVoicePresenceController,
    DmVoicePresenceController,
  ],
  providers: [VoicePresenceService, VoicePresenceGateway],
  exports: [VoicePresenceService],
})
export class VoicePresenceModule {}
