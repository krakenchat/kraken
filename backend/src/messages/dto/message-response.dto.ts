import { FileType } from '@prisma/client';

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

export class MessageDto {
  id: string;
  channelId: string | null;
  directMessageGroupId: string | null;
  authorId: string;
  spans: any[];
  attachments: string[];
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
  searchText: string | null;
  deletedBy: string | null;
  deletedByReason: string | null;
  parentMessageId: string | null;
}

export class PaginatedMessagesResponseDto {
  messages: EnrichedMessageDto[];
  continuationToken?: string;
}
