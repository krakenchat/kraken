import { User } from './auth.type';

export type FriendshipStatus = 'PENDING' | 'ACCEPTED' | 'BLOCKED';

export interface Friendship {
  id: string;
  userAId: string;
  userBId: string;
  status: FriendshipStatus;
  createdAt: string;
  userA?: User;
  userB?: User;
}

export interface PendingRequests {
  sent: Friendship[];
  received: Friendship[];
}

export interface FriendshipStatusResponse {
  status: FriendshipStatus | null;
  friendshipId: string | null;
  direction: 'sent' | 'received' | null;
}
