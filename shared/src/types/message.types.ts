export enum SpanType {
  PLAINTEXT = 'PLAINTEXT',
  USER_MENTION = 'USER_MENTION',
  SPECIAL_MENTION = 'SPECIAL_MENTION',
  COMMUNITY_MENTION = 'COMMUNITY_MENTION',
  ALIAS_MENTION = 'ALIAS_MENTION',
  // Multi-line fenced (```) code block. Its `text` is rendered verbatim —
  // no mentions, inline formatting, or auto-linking are parsed inside it.
  CODE_BLOCK = 'CODE_BLOCK',
}

export interface Span {
  type: SpanType;
  text?: string;
  userId?: string;
  specialKind?: string;
  communityId?: string;
  aliasId?: string;
  // Composable inline-formatting flags applied to PLAINTEXT spans. They combine
  // freely (a span can be bold AND italic). `code` marks an inline `code` run
  // whose text is rendered verbatim (no formatting/mentions/links inside).
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  code?: boolean;
}

export interface Reaction {
  emoji: string;
  userIds: string[];
}

export interface FileMetadata {
  id: string;
  filename: string;
  mimeType: string;
  fileType: string;
  size: number;
  hasThumbnail?: boolean;
}

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  faviconUrl?: string;
  authorName?: string;
}

export interface Message {
  id: string;
  channelId?: string;
  directMessageGroupId?: string;
  authorId: string | null;
  spans: Span[];
  attachments: FileMetadata[];
  pendingAttachments?: number;
  reactions: Reaction[];
  linkPreviews?: LinkPreview[];
  sentAt: string;
  editedAt?: string;
  deletedAt?: string;
  // Pinning fields (server DTOs send explicit null when unset)
  pinned?: boolean;
  pinnedAt?: string | null;
  pinnedBy?: string | null;
  // Threading fields
  parentMessageId?: string;
  replyCount?: number;
  lastReplyAt?: string | null;
  // Inline reply (quote) fields
  replyToId?: string | null;
  replyTo?: {
    id: string;
    authorId: string | null;
    spans: Span[];
    sentAt: string;
    deletedAt?: string | null;
  } | null;
}
