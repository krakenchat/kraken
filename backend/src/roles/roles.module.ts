import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { PermissionsService } from './permissions.service';
import { DatabaseModule } from '@/database/database.module';
import { RolesController } from './roles.controller';

@Module({
  imports: [DatabaseModule],
  providers: [RolesService, PermissionsService],
  exports: [RolesService, PermissionsService],
  controllers: [RolesController],
})
export class RolesModule {}
