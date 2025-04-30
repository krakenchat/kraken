import { Module } from '@nestjs/common';
import { CommunityService } from './community.service';
import { CommunityController } from './community.controller';
import { AuthModule } from '@/auth/auth.module';
import { RolesModule } from '@/roles/roles.module';

@Module({
  imports: [AuthModule, RolesModule],
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}
