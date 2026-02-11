export class ReadReceiptDto {
  id: string;
  userId: string;
  channelId: string | null;
  directMessageGroupId: string | null;
  lastReadMessageId: string;
  lastReadAt: Date;
}

export class UnreadCountDto {
  channelId?: string;
  directMessageGroupId?: string;
  unreadCount: number;
  lastReadMessageId?: string;
  lastReadAt?: Date;
}

export class LastReadResponseDto {
  lastReadMessageId: string | null;
}

export class MessageReaderDto {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  lastReadAt: Date;
}
