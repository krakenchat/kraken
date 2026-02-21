import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { DatabaseModule } from '@/database/database.module';
import { RolesController } from './roles.controller';

@Module({
  imports: [DatabaseModule],
  providers: [RolesService],
  exports: [RolesService],
  controllers: [RolesController],
})
export class RolesModule {}
