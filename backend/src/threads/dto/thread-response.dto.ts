export class ThreadRepliesResponseDto {
  replies: any[];
  continuationToken?: string;
  fileMetadata?: Record<string, { filename: string; mimeType: string; size: number }>;
}

export class ThreadMetadataDto {
  parentMessageId: string;
  replyCount: number;
  lastReplyAt: Date | null;
  isSubscribed: boolean;
}
