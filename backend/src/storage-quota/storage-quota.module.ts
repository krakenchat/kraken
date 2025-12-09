import { Module } from '@nestjs/common';
import { StorageQuotaService } from './storage-quota.service';
import { StorageQuotaController } from './storage-quota.controller';
import { DatabaseModule } from '@/database/database.module';
import { RolesModule } from '@/roles/roles.module';

@Module({
  imports: [DatabaseModule, RolesModule],
  controllers: [StorageQuotaController],
  providers: [StorageQuotaService],
  exports: [StorageQuotaService],
})
export class StorageQuotaModule {}
