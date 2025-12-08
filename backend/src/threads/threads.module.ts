import { Module } from '@nestjs/common';
import { ThreadsService } from './threads.service';
import { ThreadsController } from './threads.controller';
import { ThreadsGateway } from './threads.gateway';
import { DatabaseModule } from '@/database/database.module';
import { RolesModule } from '@/roles/roles.module';
import { WebsocketModule } from '@/websocket/websocket.module';
import { AuthModule } from '@/auth/auth.module';
import { NotificationsModule } from '@/notifications/notifications.module';

@Module({
  controllers: [ThreadsController],
  providers: [ThreadsService, ThreadsGateway],
  imports: [
    DatabaseModule,
    RolesModule,
    WebsocketModule,
    AuthModule,
    NotificationsModule,
  ],
  exports: [ThreadsService],
})
export class ThreadsModule {}
