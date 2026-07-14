import { Module } from '@nestjs/common';
import { LinkPreviewsService } from './link-previews.service';
import { LinkPreviewsProcessor } from './link-previews.processor';
import { DatabaseModule } from '@/database/database.module';
import { WebsocketModule } from '@/websocket/websocket.module';

@Module({
  imports: [DatabaseModule, WebsocketModule],
  providers: [
    LinkPreviewsService,
    // BullMQ consumer for the `link-previews` queue (JobsModule, @Global(),
    // provides the underlying Queue/Worker registration — see jobs.module.ts).
    LinkPreviewsProcessor,
  ],
  exports: [LinkPreviewsService],
})
export class LinkPreviewsModule {}
