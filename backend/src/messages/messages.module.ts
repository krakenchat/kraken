import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { ReactionsService } from './reactions.service';
import { ClipMessageListener } from './clip-message.listener';
import { MessagesController } from './messages.controller';
import { MessagesGateway } from './messages.gateway';
import { MessageDispatchService } from './message-dispatch.service';
import { DatabaseModule } from '@/database/database.module';
import { UserModule } from '@/user/user.module';
import { RolesModule } from '@/roles/roles.module';
import { WebsocketModule } from '@/websocket/websocket.module';
import { RoomsModule } from '@/rooms/rooms.module';
import { AuthModule } from '@/auth/auth.module';
import { FileModule } from '@/file/file.module';
import { MessageOwnershipGuard } from '@/auth/message-ownership.guard';
import { NotificationsModule } from '@/notifications/notifications.module';
import { ModerationModule } from '@/moderation/moderation.module';
import { ReadReceiptsModule } from '@/read-receipts/read-receipts.module';
import { LinkPreviewsModule } from '@/link-previews/link-previews.module';

@Module({
  controllers: [MessagesController],
  providers: [
    MessagesService,
    ReactionsService,
    MessagesGateway,
    MessageOwnershipGuard,
    ClipMessageListener,
    MessageDispatchService,
  ],
  imports: [
    DatabaseModule,
    UserModule,
    RolesModule,
    WebsocketModule,
    RoomsModule,
    AuthModule,
    FileModule,
    NotificationsModule,
    ModerationModule,
    ReadReceiptsModule,
    LinkPreviewsModule,
  ],
  exports: [MessagesService, ReactionsService, MessageDispatchService],
})
export class MessagesModule {}
