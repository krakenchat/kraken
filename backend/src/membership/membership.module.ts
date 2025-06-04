import { Module } from '@nestjs/common';
import { MembershipService } from './membership.service';
import { MembershipController } from './membership.controller';
import { DatabaseModule } from '@/database/database.module';
import { CommunityModule } from '@/community/community.module';
import { RolesModule } from '@/roles/roles.module';

@Module({
  imports: [DatabaseModule, CommunityModule, RolesModule],
  controllers: [MembershipController],
  providers: [MembershipService],
  exports: [MembershipService],
})
export class MembershipModule {}
