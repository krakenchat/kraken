import { Module } from '@nestjs/common';
import { LinkPreviewsService } from './link-previews.service';
import { DatabaseModule } from '@/database/database.module';
import { WebsocketModule } from '@/websocket/websocket.module';

@Module({
  imports: [DatabaseModule, WebsocketModule],
  providers: [LinkPreviewsService],
  exports: [LinkPreviewsService],
})
export class LinkPreviewsModule {}
