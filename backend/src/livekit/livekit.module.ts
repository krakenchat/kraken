import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '@/database/database.module';
import { StorageModule } from '@/storage/storage.module';
import { WebsocketModule } from '@/websocket/websocket.module';
import { MessagesModule } from '@/messages/messages.module';
import { LivekitService } from './livekit.service';
import { LivekitReplayService } from './livekit-replay.service';
import { FfmpegService } from './ffmpeg.service';
import { FfmpegProvider } from './providers/ffmpeg.provider';
import { LivekitController } from './livekit.controller';
import { LivekitWebhookController } from './livekit-webhook.controller';
import { UserModule } from '@/user/user.module';
import { RolesModule } from '@/roles/roles.module';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    AuthModule,
    DatabaseModule,
    StorageModule,
    WebsocketModule,
    MessagesModule,
    UserModule,
    RolesModule,
  ],
  controllers: [LivekitController, LivekitWebhookController],
  providers: [
    LivekitService,
    LivekitReplayService,
    FfmpegService,
    FfmpegProvider,
  ],
  exports: [LivekitService, LivekitReplayService],
})
export class LivekitModule {}
