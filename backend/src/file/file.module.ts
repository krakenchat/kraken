import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { DatabaseModule } from '@/database/database.module';
import { MembershipModule } from '@/membership/membership.module';
import { ChannelMembershipModule } from '@/channel-membership/channel-membership.module';
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
  imports: [DatabaseModule, MembershipModule, ChannelMembershipModule],
})
export class FileModule {}
