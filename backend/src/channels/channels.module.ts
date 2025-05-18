import { Module } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';
import { RolesModule } from '@/roles/roles.module';
import { DatabaseModule } from '@/database/database.module';

@Module({
  controllers: [ChannelsController],
  providers: [ChannelsService],
  imports: [RolesModule, DatabaseModule],
})
export class ChannelsModule {}
