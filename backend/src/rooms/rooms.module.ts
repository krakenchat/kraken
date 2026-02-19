import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsGateway } from './rooms.gateway';
import { RoomSubscriptionHandler } from './room-subscription.handler';
import { AuthModule } from '@/auth/auth.module';
import { UserModule } from '@/user/user.module';
import { WebsocketModule } from '@/websocket/websocket.module';
import { DatabaseModule } from '@/database/database.module';
import { RolesModule } from '@/roles/roles.module';

@Module({
  providers: [RoomsGateway, RoomsService, RoomSubscriptionHandler],
  imports: [
    AuthModule,
    UserModule,
    WebsocketModule,
    DatabaseModule,
    RolesModule,
  ],
})
export class RoomsModule {}
