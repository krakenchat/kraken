import { Module } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';
import { RolesModule } from '@/roles/roles.module';
import { DatabaseModule } from '@/database/database.module';
import { WebsocketModule } from '@/websocket/websocket.module';

@Module({
  controllers: [ChannelsController],
  providers: [ChannelsService],
  imports: [RolesModule, DatabaseModule, WebsocketModule],
  exports: [ChannelsService],
})
export class ChannelsModule {}
