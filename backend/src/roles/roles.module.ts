import { Module } from '@nestjs/common';
import { CommunityRolesService } from './community-roles.service';
import { InstanceRolesService } from './instance-roles.service';
import { PermissionsService } from './permissions.service';
import { PermissionsCacheService } from './permissions-cache.service';
import { DatabaseModule } from '@/database/database.module';
import { RedisModule } from '@/redis/redis.module';
import { RolesController } from './roles.controller';

@Module({
  imports: [DatabaseModule, RedisModule],
  providers: [
    CommunityRolesService,
    InstanceRolesService,
    PermissionsService,
    PermissionsCacheService,
  ],
  exports: [
    CommunityRolesService,
    InstanceRolesService,
    PermissionsService,
    PermissionsCacheService,
  ],
  controllers: [RolesController],
})
export class RolesModule {}
