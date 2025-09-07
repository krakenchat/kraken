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
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ChannelsModule } from './channels/channels.module';
import { MessagesModule } from './messages/messages.module';
import { RoomsModule } from './rooms/rooms.module';
import { WebsocketService } from './websocket/websocket.service';
import { WebsocketModule } from './websocket/websocket.module';
import { RedisModule } from './redis/redis.module';
import { CacheModule } from './cache/cache.module';
import { PresenceModule } from './presence/presence.module';
import { MembershipModule } from './membership/membership.module';
import { ChannelMembershipModule } from './channel-membership/channel-membership.module';
import { LivekitModule } from './livekit/livekit.module';
import { VoicePresenceModule } from './voice-presence/voice-presence.module';
import { OnboardingModule } from './onboarding/onboarding.module';

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    InviteModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    RolesModule,
    UserModule,
    CommunityModule,
    MessagesModule,
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 50,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 500,
      },
    ]),
    ChannelsModule,
    RoomsModule,
    WebsocketModule,
    RedisModule,
    CacheModule,
    PresenceModule,
    MembershipModule,
    ChannelMembershipModule,
    LivekitModule,
    VoicePresenceModule,
    OnboardingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    WebsocketService,
  ],
})
export class AppModule {}
