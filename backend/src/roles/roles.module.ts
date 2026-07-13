import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { PermissionsService } from './permissions.service';
import { PermissionsCacheService } from './permissions-cache.service';
import { DatabaseModule } from '@/database/database.module';
import { RedisModule } from '@/redis/redis.module';
import { RolesController } from './roles.controller';

@Module({
  imports: [DatabaseModule, RedisModule],
  providers: [RolesService, PermissionsService, PermissionsCacheService],
  exports: [RolesService, PermissionsService, PermissionsCacheService],
  controllers: [RolesController],
})
export class RolesModule {}
