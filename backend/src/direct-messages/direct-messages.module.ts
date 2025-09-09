import { Module } from '@nestjs/common';
import { DirectMessagesController } from './direct-messages.controller';
import { DirectMessagesService } from './direct-messages.service';
import { DatabaseModule } from '@/database/database.module';
import { MessagesModule } from '@/messages/messages.module';
import { RolesModule } from '@/roles/roles.module';

@Module({
  imports: [DatabaseModule, MessagesModule, RolesModule],
  controllers: [DirectMessagesController],
  providers: [DirectMessagesService],
  exports: [DirectMessagesService],
})
export class DirectMessagesModule {}
