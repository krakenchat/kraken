import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { RolesModule } from '@/roles/roles.module';
import { WebsocketModule } from '@/websocket/websocket.module';
import { MessagesModule } from '@/messages/messages.module';
import { LinkPreviewsModule } from '@/link-previews/link-previews.module';
import {
  WebhookExecutionController,
  WebhooksController,
} from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  controllers: [WebhooksController, WebhookExecutionController],
  providers: [WebhooksService],
  imports: [
    DatabaseModule,
    RolesModule,
    WebsocketModule,
    MessagesModule,
    LinkPreviewsModule,
  ],
  exports: [WebhooksService],
})
export class WebhooksModule {}
