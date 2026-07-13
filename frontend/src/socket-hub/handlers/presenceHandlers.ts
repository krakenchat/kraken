import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { UserPresenceInfo, UserProfileUpdatedPayload, ServerEvents } from '@semaphore-chat/shared';
import type { UserControllerGetProfileResponse } from '../../api-client';
import {
  presenceControllerGetUserPresenceQueryKey,
  presenceControllerGetBulkPresenceQueryKey,
  userControllerGetUserByIdQueryKey,
  userControllerGetProfileQueryKey,
} from '../../api-client/@tanstack/react-query.gen';
import type { SocketEventHandler } from './types';

/**
 * Extract the comma-joined `userIds` path param that
 * `presenceControllerGetMultipleUserPresenceQueryKey` embeds in the query key
 * (`[{ _id, baseUrl, path: { userIds: 'a,b,c' } }]`). Returns null when the
 * key doesn't have the expected shape, so callers can fall back to
 * invalidating instead of guessing.
 */
function parseMultiPresenceUserIds(queryKey: QueryKey): string[] | null {
  const keyPart = queryKey[0];
  if (typeof keyPart !== 'object' || keyPart === null) return null;

  const path = (keyPart as { path?: unknown }).path;
  if (typeof path !== 'object' || path === null) return null;

  const userIds = (path as { userIds?: unknown }).userIds;
  if (typeof userIds !== 'string' || userIds.length === 0) return null;

  return userIds.split(',').filter(Boolean);
}

/**
 * Patch every cached `presenceControllerGetMultipleUserPresence` query whose
 * parsed userIds include `userId`, in place — no refetch, no re-render of
 * unrelated queries. Queries whose key can't be parsed confidently fall back
 * to a targeted invalidation of just that query (safety net).
 */
function patchMultiPresenceCaches(queryClient: QueryClient, userId: string, isOnline: boolean): void {
  const queries = queryClient.getQueryCache().findAll({
    queryKey: [{ _id: 'presenceControllerGetMultipleUserPresence' }],
  });

  for (const query of queries) {
    const userIds = parseMultiPresenceUserIds(query.queryKey);

    if (userIds === null) {
      void queryClient.invalidateQueries({ queryKey: query.queryKey, exact: true });
      continue;
    }

    if (!userIds.includes(userId)) continue;

    queryClient.setQueryData(
      query.queryKey,
      (old: { presence: Record<string, boolean> } | undefined) => {
        if (!old) return old;
        return { ...old, presence: { ...old.presence, [userId]: isOnline } };
      },
    );
  }
}

export const handleUserOnline: SocketEventHandler<typeof ServerEvents.USER_ONLINE> = (
  data: UserPresenceInfo,
  queryClient: QueryClient,
) => {
  queryClient.setQueryData(
    presenceControllerGetUserPresenceQueryKey({ path: { userId: data.userId } }),
    (old: { isOnline: boolean } | undefined) => (old ? { ...old, isOnline: true } : old),
  );

  queryClient.setQueryData(
    presenceControllerGetBulkPresenceQueryKey(),
    (old: { presence: Record<string, boolean> } | undefined) => {
      if (!old) return old;
      return { ...old, presence: { ...old.presence, [data.userId]: true } };
    },
  );

  patchMultiPresenceCaches(queryClient, data.userId, true);
};

export const handleUserOffline: SocketEventHandler<typeof ServerEvents.USER_OFFLINE> = (
  data: UserPresenceInfo,
  queryClient: QueryClient,
) => {
  queryClient.setQueryData(
    presenceControllerGetUserPresenceQueryKey({ path: { userId: data.userId } }),
    (old: { isOnline: boolean } | undefined) => (old ? { ...old, isOnline: false } : old),
  );

  queryClient.setQueryData(
    presenceControllerGetBulkPresenceQueryKey(),
    (old: { presence: Record<string, boolean> } | undefined) => {
      if (!old) return old;
      return { ...old, presence: { ...old.presence, [data.userId]: false } };
    },
  );

  patchMultiPresenceCaches(queryClient, data.userId, false);
};

// =============================================================================
// User Profile Update
// =============================================================================

export const handleUserProfileUpdated: SocketEventHandler<typeof ServerEvents.USER_PROFILE_UPDATED> = (
  payload: UserProfileUpdatedPayload,
  queryClient: QueryClient,
) => {
  // Only invalidate the current user's own profile query if they are the one who updated
  const currentUser = queryClient.getQueryData<UserControllerGetProfileResponse>(
    userControllerGetProfileQueryKey(),
  );
  if (currentUser && payload.userId === currentUser.id) {
    queryClient.invalidateQueries({ queryKey: [{ _id: 'userControllerGetProfile' }] });
  }

  // Invalidate the useUser() cache for this user so all UserAvatar
  // instances and other components showing this user's data refresh
  queryClient.invalidateQueries({
    queryKey: userControllerGetUserByIdQueryKey({ path: { id: payload.userId } }),
  });
};
