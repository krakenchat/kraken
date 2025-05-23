import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MessagesGateway } from './messages.gateway';
import { DatabaseModule } from '@/database/database.module';
import { UserModule } from '@/user/user.module';
import { RolesModule } from '@/roles/roles.module';
import { WebsocketModule } from '@/websocket/websocket.module';
import { RoomsModule } from '@/rooms/rooms.module';
import { AuthModule } from '@/auth/auth.module';

@Module({
  controllers: [MessagesController],
  providers: [MessagesService, MessagesGateway],
  imports: [
    DatabaseModule,
    UserModule,
    RolesModule,
    WebsocketModule,
    RoomsModule,
    AuthModule,
  ],
})
export class MessagesModule {}
