import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { DatabaseModule } from '../database/database.module';
import { InviteModule } from '../invite/invite.module';
import { ChannelsModule } from '../channels/channels.module';

@Module({
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
  imports: [DatabaseModule, InviteModule, ChannelsModule],
})
export class UserModule {}
