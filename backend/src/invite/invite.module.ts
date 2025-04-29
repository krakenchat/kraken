import { Module } from '@nestjs/common';
import { InviteService } from './invite.service';
import { InviteController } from './invite.controller';
import { DatabaseModule } from '../database/database.module';
import { RolesModule } from '@/roles/roles.module';

@Module({
  imports: [DatabaseModule, RolesModule],
  providers: [InviteService],
  controllers: [InviteController],
  exports: [InviteService],
})
export class InviteModule {}
