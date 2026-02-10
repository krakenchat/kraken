import { FileType, Message } from '@prisma/client';

export class EnrichedAttachment {
  id: string;
  filename: string;
  mimeType: string;
  fileType: FileType;
  size: number;
}

export class EnrichedMessageDto {
  id: string;
  channelId: string | null;
  directMessageGroupId: string | null;
  authorId: string;
  spans: any[];
  attachments: EnrichedAttachment[];
  pendingAttachments: number | null;
  reactions: any[];
  replyCount: number;
  lastReplyAt: Date | null;
  pinned: boolean;
  pinnedAt: Date | null;
  pinnedBy: string | null;
  sentAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
}

export class PaginatedMessagesResponseDto {
  messages: EnrichedMessageDto[];
  continuationToken?: string;
}
