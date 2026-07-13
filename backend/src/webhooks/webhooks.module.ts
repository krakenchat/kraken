import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { RolesModule } from '@/roles/roles.module';
import { MessagesModule } from '@/messages/messages.module';
import {
  WebhookExecutionController,
  WebhooksController,
} from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  controllers: [WebhooksController, WebhookExecutionController],
  providers: [WebhooksService],
  imports: [DatabaseModule, RolesModule, MessagesModule],
  exports: [WebhooksService],
})
export class WebhooksModule {}
