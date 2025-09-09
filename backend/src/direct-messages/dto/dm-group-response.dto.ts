export class DmGroupResponseDto {
  id: string;
  name?: string | null;
  isGroup: boolean;
  createdAt: Date;
  members: {
    id: string;
    userId: string;
    joinedAt: Date;
    user: {
      id: string;
      username: string;
      displayName?: string | null;
      avatarUrl?: string | null;
    };
  }[];
  lastMessage?: {
    id: string;
    authorId: string;
    spans: any[];
    sentAt: Date;
  } | null;
}
