import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { DatabaseModule } from '@/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
