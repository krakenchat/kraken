export class ThreadReplyDto {
  id: string;
  channelId: string | null;
  directMessageGroupId: string | null;
  authorId: string;
  spans: any[];
  attachments: string[];
  pendingAttachments: number | null;
  reactions: any[];
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

export class ThreadRepliesResponseDto {
  replies: any[];
  continuationToken?: string;
  fileMetadata?: Record<
    string,
    { filename: string; mimeType: string; size: number }
  >;
}

export class ThreadMetadataDto {
  parentMessageId: string;
  replyCount: number;
  lastReplyAt: Date | null;
  isSubscribed: boolean;
}
