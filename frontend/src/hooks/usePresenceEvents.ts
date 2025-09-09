import { useEffect } from "react";
import { useSocket } from "./useSocket";
import { ServerEvents } from "../types/server-events.enum";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { presenceApi } from "../features/presence/presenceApiSlice";

interface UserPresencePayload {
  userId: string;
  username?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

/**
 * Hook to listen for real-time presence events and update the presence cache
 */
export const usePresenceEvents = () => {
  const socket = useSocket();
  const dispatch = useAppDispatch();
  const presenceState = useAppSelector((state) => state.presenceApi);

  useEffect(() => {
    if (!socket) return;

    const handleUserOnline = (data: UserPresencePayload) => {
      // Update presence cache for single user query
      dispatch(
        presenceApi.util.updateQueryData('getUserPresence', data.userId, (draft) => {
          draft.isOnline = true;
        })
      );

      // Update presence cache for bulk queries
      dispatch(
        presenceApi.util.updateQueryData('getBulkPresence', undefined, (draft) => {
          draft.presence[data.userId] = true;
        })
      );

      // Update presence cache for multiple user queries that include this user
      const presenceQueries = presenceState?.queries || {};
      
      Object.keys(presenceQueries).forEach((queryKey) => {
        if (queryKey.startsWith('getMultipleUserPresence')) {
          const queryData = presenceQueries[queryKey];
          if (queryData?.data?.presence && queryData.data.presence.hasOwnProperty(data.userId)) {
            dispatch(
              presenceApi.util.updateQueryData('getMultipleUserPresence', queryData.originalArgs, (draft) => {
                draft.presence[data.userId] = true;
              })
            );
          }
        }
      });
    };

    const handleUserOffline = (data: UserPresencePayload) => {
      // Update presence cache for single user query
      dispatch(
        presenceApi.util.updateQueryData('getUserPresence', data.userId, (draft) => {
          draft.isOnline = false;
        })
      );

      // Update presence cache for bulk queries
      dispatch(
        presenceApi.util.updateQueryData('getBulkPresence', undefined, (draft) => {
          draft.presence[data.userId] = false;
        })
      );

      // Update presence cache for multiple user queries that include this user
      const presenceQueries = presenceState?.queries || {};
      
      Object.keys(presenceQueries).forEach((queryKey) => {
        if (queryKey.startsWith('getMultipleUserPresence')) {
          const queryData = presenceQueries[queryKey];
          if (queryData?.data?.presence && queryData.data.presence.hasOwnProperty(data.userId)) {
            dispatch(
              presenceApi.util.updateQueryData('getMultipleUserPresence', queryData.originalArgs, (draft) => {
                draft.presence[data.userId] = false;
              })
            );
          }
        }
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
  }, [socket, dispatch, presenceState]);

  return null; // This hook doesn't return any value
};