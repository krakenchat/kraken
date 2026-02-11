import { FileType, ModerationAction, Prisma } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import {
  FileTypeValues,
  ModerationActionValues,
} from '@/common/enums/swagger-enums';
import { SpanDto, ReactionDto } from '@/messages/dto/message-response.dto';

export { SuccessMessageDto } from '@/common/dto/common-response.dto';

export class PinnedMessageAuthorDto {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export class PinnedMessageAttachmentDto {
  id: string;
  filename: string;
  mimeType: string;
  @ApiProperty({ enum: FileTypeValues })
  fileType: FileType;
  size: number;
}

export class PinnedMessageDto {
  id: string;
  channelId: string | null;
  directMessageGroupId: string | null;
  authorId: string;
  spans: SpanDto[];
  reactions: ReactionDto[];
  sentAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  pinned: boolean;
  pinnedAt: Date | null;
  pinnedBy: string | null;
  replyCount: number;
  lastReplyAt: Date | null;
  searchText: string | null;
  pendingAttachments: number | null;
  deletedBy: string | null;
  deletedByReason: string | null;
  parentMessageId: string | null;
  author: PinnedMessageAuthorDto | null;
  attachments: PinnedMessageAttachmentDto[];
}

export class CommunityBanDto {
  id: string;
  communityId: string;
  userId: string;
  moderatorId: string;
  reason: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  active: boolean;
}

export class CommunityTimeoutDto {
  id: string;
  communityId: string;
  userId: string;
  moderatorId: string;
  reason: string | null;
  createdAt: Date;
  expiresAt: Date;
}

export class ModerationLogDto {
  id: string;
  communityId: string;
  moderatorId: string;
  targetUserId: string | null;
  @ApiProperty({ enum: ModerationActionValues })
  action: ModerationAction;
  reason: string | null;
  @ApiProperty({ type: 'object', nullable: true, additionalProperties: true })
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
}

export class TimeoutStatusResponseDto {
  isTimedOut: boolean;
  expiresAt?: Date;
}

export class ModerationLogsResponseDto {
  logs: ModerationLogDto[];
  total: number;
}
