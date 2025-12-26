import { Module } from '@nestjs/common';
import { AliasGroupsController } from './alias-groups.controller';
import { AliasGroupsService } from './alias-groups.service';
import { DatabaseModule } from '@/database/database.module';
import { RolesModule } from '@/roles/roles.module';

@Module({
  imports: [DatabaseModule, RolesModule],
  controllers: [AliasGroupsController],
  providers: [AliasGroupsService],
  exports: [AliasGroupsService],
})
export class AliasGroupsModule {}
