import { Module } from '@nestjs/common';
import { PostgresPrismaService } from './postgres-prisma.service';
import { MongoPrismaService } from './mongo-prisma.service';

@Module({
  providers: [PostgresPrismaService, MongoPrismaService],
  exports: [PostgresPrismaService, MongoPrismaService],
})
export class DatabaseModule {}
