import type { QueryClient } from '@tanstack/react-query';
import type { UserPresenceInfo, ServerEvents } from '@kraken/shared';
import {
  presenceControllerGetUserPresenceQueryKey,
  presenceControllerGetBulkPresenceQueryKey,
} from '../../api-client/@tanstack/react-query.gen';
import type { SocketEventHandler } from './types';

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

  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      if (typeof key === 'object' && key !== null && '_id' in key) {
        return (key as { _id: string })._id === 'presenceControllerGetMultipleUserPresence';
      }
      return false;
    },
  });
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

  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      if (typeof key === 'object' && key !== null && '_id' in key) {
        return (key as { _id: string })._id === 'presenceControllerGetMultipleUserPresence';
      }
      return false;
    },
  });
};
