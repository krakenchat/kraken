import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { DatabaseModule } from '@/database/database.module';
import { WebsocketModule } from '@/websocket/websocket.module';
import { AuthModule } from '@/auth/auth.module';
import { UserModule } from '@/user/user.module';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway],
  imports: [DatabaseModule, WebsocketModule, AuthModule, UserModule],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
