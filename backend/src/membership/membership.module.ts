import { Module } from '@nestjs/common';
import { MembershipService } from './membership.service';
import { MembershipController } from './membership.controller';
import { DatabaseModule } from '@/database/database.module';
import { CommunityModule } from '@/community/community.module';

@Module({
  imports: [DatabaseModule, CommunityModule],
  controllers: [MembershipController],
  providers: [MembershipService],
  exports: [MembershipService],
})
export class MembershipModule {}
