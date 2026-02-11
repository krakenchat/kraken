import { useEffect } from "react";
import { useSocket } from "./useSocket";
import { ServerEvents, type UserPresenceInfo } from '@kraken/shared';
import { useQueryClient } from "@tanstack/react-query";
import {
  presenceControllerGetUserPresenceQueryKey,
  presenceControllerGetBulkPresenceQueryKey,
} from "../api-client/@tanstack/react-query.gen";

/**
 * Hook to listen for real-time presence events and update the presence cache
 */
export const usePresenceEvents = () => {
  const socket = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const handleUserOnline = (data: UserPresenceInfo) => {
      // Update presence cache for single user query
      queryClient.setQueryData(
        presenceControllerGetUserPresenceQueryKey({ path: { userId: data.userId } }),
        (old: { isOnline: boolean } | undefined) => old ? { ...old, isOnline: true } : old
      );

      // Update presence cache for bulk queries
      queryClient.setQueryData(
        presenceControllerGetBulkPresenceQueryKey(),
        (old: { presence: Record<string, boolean> } | undefined) => {
          if (!old) return old;
          return { ...old, presence: { ...old.presence, [data.userId]: true } };
        }
      );

      // Invalidate all multiple user presence queries that might contain this user
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

    const handleUserOffline = (data: UserPresenceInfo) => {
      // Update presence cache for single user query
      queryClient.setQueryData(
        presenceControllerGetUserPresenceQueryKey({ path: { userId: data.userId } }),
        (old: { isOnline: boolean } | undefined) => old ? { ...old, isOnline: false } : old
      );

      // Update presence cache for bulk queries
      queryClient.setQueryData(
        presenceControllerGetBulkPresenceQueryKey(),
        (old: { presence: Record<string, boolean> } | undefined) => {
          if (!old) return old;
          return { ...old, presence: { ...old.presence, [data.userId]: false } };
        }
      );

      // Invalidate all multiple user presence queries that might contain this user
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

    // Listen for presence events
    socket.on(ServerEvents.USER_ONLINE, handleUserOnline);
    socket.on(ServerEvents.USER_OFFLINE, handleUserOffline);

    // Cleanup listeners
    return () => {
      socket.off(ServerEvents.USER_ONLINE, handleUserOnline);
      socket.off(ServerEvents.USER_OFFLINE, handleUserOffline);
    };
  }, [socket, queryClient]);

  return null; // This hook doesn't return any value
};
