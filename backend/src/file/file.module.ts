import { Module, forwardRef } from '@nestjs/common';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { DatabaseModule } from '@/database/database.module';
import { StorageModule } from '@/storage/storage.module';
import { MembershipModule } from '@/membership/membership.module';
import { ChannelMembershipModule } from '@/channel-membership/channel-membership.module';
import { StorageQuotaModule } from '@/storage-quota/storage-quota.module';
import { FileAccessGuard } from '@/file/file-access/file-access.guard';
import {
  PublicAccessStrategy,
  CommunityMembershipStrategy,
  MessageAttachmentStrategy,
} from '@/file/file-access/strategies';

@Module({
  controllers: [FileController],
  providers: [
    FileService,
    FileAccessGuard,
    PublicAccessStrategy,
    CommunityMembershipStrategy,
    MessageAttachmentStrategy,
  ],
  imports: [
    DatabaseModule,
    StorageModule,
    MembershipModule,
    ChannelMembershipModule,
    forwardRef(() => StorageQuotaModule),
  ],
  exports: [FileService],
})
export class FileModule {}
