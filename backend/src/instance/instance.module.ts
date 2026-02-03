import { Module } from '@nestjs/common';
import { InstanceService } from './instance.service';
import { InstanceController } from './instance.controller';
import { DatabaseModule } from '@/database/database.module';
import { RolesModule } from '@/roles/roles.module';

@Module({
  imports: [DatabaseModule, RolesModule],
  providers: [InstanceService],
  controllers: [InstanceController],
  exports: [InstanceService],
})
export class InstanceModule {}
