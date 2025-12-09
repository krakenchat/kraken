import { Module } from '@nestjs/common';
import { StorageQuotaService } from './storage-quota.service';
import { StorageQuotaController } from './storage-quota.controller';
import { DatabaseModule } from '@/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [StorageQuotaController],
  providers: [StorageQuotaService],
  exports: [StorageQuotaService],
})
export class StorageQuotaModule {}
