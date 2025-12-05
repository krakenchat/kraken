import { Module, forwardRef } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MessagesGateway } from './messages.gateway';
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

@Module({
  controllers: [MessagesController],
  providers: [MessagesService, MessagesGateway, MessageOwnershipGuard],
  imports: [
    DatabaseModule,
    UserModule,
    RolesModule,
    WebsocketModule,
    RoomsModule,
    AuthModule,
    FileModule,
    forwardRef(() => NotificationsModule),
    forwardRef(() => ModerationModule),
  ],
  exports: [MessagesService],
})
export class MessagesModule {}
