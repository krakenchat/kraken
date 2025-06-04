import { Module } from '@nestjs/common';
import { ChannelMembershipService } from './channel-membership.service';
import { ChannelMembershipController } from './channel-membership.controller';
import { DatabaseModule } from '@/database/database.module';
import { RolesModule } from '@/roles/roles.module';

@Module({
  imports: [DatabaseModule, RolesModule],
  controllers: [ChannelMembershipController],
  providers: [ChannelMembershipService],
  exports: [ChannelMembershipService],
})
export class ChannelMembershipModule {}
