import { Module } from '@nestjs/common';
import { InstanceService } from './instance.service';
import { InstanceController } from './instance.controller';
import { DatabaseModule } from '@/database/database.module';
import { RolesModule } from '@/roles/roles.module';
import { MailerModule } from '@/mailer/mailer.module';

@Module({
  imports: [DatabaseModule, RolesModule, MailerModule],
  providers: [InstanceService],
  controllers: [InstanceController],
  exports: [InstanceService],
})
export class InstanceModule {}
