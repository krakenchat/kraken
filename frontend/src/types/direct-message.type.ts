export interface DirectMessageGroup {
  id: string;
  name?: string | null;
  isGroup: boolean;
  createdAt: Date;
  members: DirectMessageGroupMember[];
  lastMessage?: {
    id: string;
    authorId: string;
    spans: any[];
    sentAt: Date;
  } | null;
}

export interface DirectMessageGroupMember {
  id: string;
  userId: string;
  joinedAt: Date;
  user: {
    id: string;
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
}

export interface CreateDmGroupDto {
  userIds: string[];
  name?: string;
  isGroup?: boolean;
}

export interface AddMembersDto {
  userIds: string[];
}