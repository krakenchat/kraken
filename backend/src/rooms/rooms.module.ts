import { Module, forwardRef } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsGateway } from './rooms.gateway';
import { RoomSubscriptionHandler } from './room-subscription.handler';
import { AuthModule } from '@/auth/auth.module';
import { UserModule } from '@/user/user.module';
import { WebsocketModule } from '@/websocket/websocket.module';
import { DatabaseModule } from '@/database/database.module';
import { RolesModule } from '@/roles/roles.module';
import { VoicePresenceModule } from '@/voice-presence/voice-presence.module';
import { LivekitModule } from '@/livekit/livekit.module';

@Module({
  providers: [RoomsGateway, RoomsService, RoomSubscriptionHandler],
  imports: [
    AuthModule,
    UserModule,
    WebsocketModule,
    DatabaseModule,
    RolesModule,
    // forwardRef to break MessagesModule -> RoomsModule -> VoicePresenceModule -> LivekitModule -> MessagesModule cycle
    forwardRef(() => VoicePresenceModule),
    forwardRef(() => LivekitModule),
  ],
})
export class RoomsModule {}
