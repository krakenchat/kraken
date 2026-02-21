import { Module } from '@nestjs/common';
import { CommunityService } from './community.service';
import { CommunityController } from './community.controller';
import { AuthModule } from '@/auth/auth.module';
import { RolesModule } from '@/roles/roles.module';
import { DatabaseModule } from '@/database/database.module';
import { ChannelsModule } from '@/channels/channels.module';
import { WebsocketModule } from '@/websocket/websocket.module';

@Module({
  imports: [AuthModule, RolesModule, DatabaseModule, ChannelsModule, WebsocketModule],
  controllers: [CommunityController],
  providers: [CommunityService],
  exports: [CommunityService],
})
export class CommunityModule {}
