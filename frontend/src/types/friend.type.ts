// The API client's generated friendship DTOs are the source of truth.
export type {
  FriendshipWithUsersDto as Friendship,
  PendingRequestsDto as PendingRequests,
} from '../api-client/types.gen';

import type { FriendshipWithUsersDto } from '../api-client/types.gen';

export type FriendshipStatus = FriendshipWithUsersDto['status'];

export interface FriendshipStatusResponse {
  status: FriendshipStatus | null;
  friendshipId: string | null;
  direction: 'sent' | 'received' | null;
}
