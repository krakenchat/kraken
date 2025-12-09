export interface ReadReceipt {
  id: string;
  userId: string;
  channelId?: string;
  directMessageGroupId?: string;
  lastReadMessageId: string;
  lastReadAt: Date;
}

export interface UnreadCount {
  channelId?: string;
  directMessageGroupId?: string;
  unreadCount: number;
  lastReadMessageId?: string;
  lastReadAt?: Date;
}

export interface MarkAsReadPayload {
  lastReadMessageId: string;
  channelId?: string;
  directMessageGroupId?: string;
}

export interface ReadReceiptUpdatedPayload {
  channelId?: string;
  directMessageGroupId?: string;
  lastReadMessageId: string;
  lastReadAt: Date;
}

export interface MessageReader {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  readAt: Date;
}
