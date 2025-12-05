import { Module } from '@nestjs/common';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { DatabaseModule } from '@/database/database.module';
import { RolesModule } from '@/roles/roles.module';
import { MembershipModule } from '@/membership/membership.module';
import { WebsocketModule } from '@/websocket/websocket.module';

@Module({
  imports: [DatabaseModule, RolesModule, MembershipModule, WebsocketModule],
  controllers: [ModerationController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
