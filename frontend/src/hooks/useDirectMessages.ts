import React, { useState } from "react";
import { useSelector } from "react-redux";
import { useGetDmMessagesQuery } from "../features/directMessages/directMessagesApiSlice";
import { 
  makeSelectMessagesByChannel,
  makeSelectContinuationTokenByChannel 
} from "../features/messages/messagesSlice";
import { useDirectMessageWebSocket } from "./useDirectMessageWebSocket";
import type { RootState } from "../app/store";
import type { Message } from "../types/message.type";

export const useDirectMessages = (dmGroupId: string) => {
  const [isLoadingMore] = useState(false); // DMs don't have pagination yet
  
  // WebSocket connection for DMs
  const { joinDmGroup, leaveDmGroup } = useDirectMessageWebSocket();

  // Initial data fetch - this will populate Redux store via onQueryStarted
  const { error, isLoading } = useGetDmMessagesQuery(dmGroupId);

  // Memoized selectors for this specific DM group (same pattern as channels)
  const selectMessagesByChannel = React.useMemo(
    () => makeSelectMessagesByChannel(),
    []
  );
  const selectContinuationTokenByChannel = React.useMemo(
    () => makeSelectContinuationTokenByChannel(),
    []
  );

  // Get messages from Redux store only (same pattern as channels)
  const messages: Message[] = useSelector((state: RootState) =>
    selectMessagesByChannel(state, dmGroupId)
  );
  const continuationToken = useSelector((state: RootState) =>
    selectContinuationTokenByChannel(state, dmGroupId)
  );

  // Join/leave DM group for WebSocket
  React.useEffect(() => {
    joinDmGroup(dmGroupId);
    
    return () => {
      leaveDmGroup(dmGroupId);
    };
  }, [dmGroupId, joinDmGroup, leaveDmGroup]);

  return {
    messages,
    isLoading,
    error,
    continuationToken,
    isLoadingMore,
    onLoadMore: undefined, // DMs don't support pagination yet
  };
};