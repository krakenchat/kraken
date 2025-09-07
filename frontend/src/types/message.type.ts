export enum SpanType {
  PLAINTEXT = "PLAINTEXT",
  USER_MENTION = "USER_MENTION",
  SPECIAL_MENTION = "SPECIAL_MENTION",
  COMMUNITY_MENTION = "COMMUNITY_MENTION",
  ALIAS_MENTION = "ALIAS_MENTION",
}

export interface Span {
  type: SpanType;
  text?: string;
  userId?: string;
  specialKind?: string;
  communityId?: string;
  aliasId?: string;
}

export interface Attachment {
  url: string;
  filename: string;
  filetype: string;
  size: number;
}

export interface Reaction {
  emoji: string;
  userIds: string[];
}

export interface Message {
  id: string;
  channelId?: string;
  directMessageGroupId?: string;
  authorId: string;
  spans: Span[];
  attachments: Attachment[];
  reactions: Reaction[];
  sentAt: string;
  editedAt?: string;
  deletedAt?: string;
}
