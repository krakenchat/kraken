import { ApiProperty } from '@nestjs/swagger';
import {
  SpanDto,
  ReactionDto,
  EnrichedAttachment,
} from '@/messages/dto/message-response.dto';

export class ThreadReplyDto {
  id: string;
  channelId: string | null;
  directMessageGroupId: string | null;
  authorId: string;
  spans: SpanDto[];
  attachments: string[];
  pendingAttachments: number | null;
  reactions: ReactionDto[];
  sentAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  pinned: boolean;
  pinnedAt: Date | null;
  pinnedBy: string | null;
  replyCount: number;
  lastReplyAt: Date | null;
  parentMessageId: string | null;
  searchText: string | null;
  deletedBy: string | null;
  deletedByReason: string | null;
}

export class EnrichedThreadReplyDto {
  id: string;
  channelId: string | null;
  directMessageGroupId: string | null;
  authorId: string;
  spans: SpanDto[];
  attachments: EnrichedAttachment[];
  pendingAttachments: number | null;
  reactions: ReactionDto[];
  sentAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  pinned: boolean;
  pinnedAt: Date | null;
  pinnedBy: string | null;
  replyCount: number;
  lastReplyAt: Date | null;
  parentMessageId: string | null;
  searchText: string | null;
  deletedBy: string | null;
  deletedByReason: string | null;
}

export class FileMetadataEntryDto {
  filename: string;
  mimeType: string;
  size: number;
}

export class ThreadRepliesResponseDto {
  replies: EnrichedThreadReplyDto[];
  continuationToken?: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'object' },
    nullable: true,
  })
  fileMetadata?: Record<string, FileMetadataEntryDto>;
}

export class ThreadMetadataDto {
  parentMessageId: string;
  replyCount: number;
  lastReplyAt: Date | null;
  isSubscribed: boolean;
}
