import React, { useState } from "react";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { directMessagesControllerGetDmMessagesOptions } from "../api-client/@tanstack/react-query.gen";
import {
  makeSelectMessagesByContext,
  makeSelectContinuationTokenByContext,
} from "../features/messages/messagesSlice";
import { useDirectMessageWebSocket } from "./useDirectMessageWebSocket";
import type { RootState } from "../app/store";
import type { Message } from "../types/message.type";

export const useDirectMessages = (dmGroupId: string) => {
  const [isLoadingMore] = useState(false); // DMs don't have pagination yet

  // WebSocket connection for DMs
  const { joinDmGroup, leaveDmGroup } = useDirectMessageWebSocket();

  // Initial data fetch - this will populate Redux store via onQueryStarted
  const { error, isLoading } = useQuery(directMessagesControllerGetDmMessagesOptions({ path: { id: dmGroupId } }));

  // Memoized selectors for this DM group (contextId = dmGroupId)
  const selectMessages = React.useMemo(
    () => makeSelectMessagesByContext(),
    []
  );
  const selectContinuationToken = React.useMemo(
    () => makeSelectContinuationTokenByContext(),
    []
  );

  // Get messages from Redux store (contextId = dmGroupId)
  const messages: Message[] = useSelector((state: RootState) =>
    selectMessages(state, dmGroupId)
  );
  const continuationToken = useSelector((state: RootState) =>
    selectContinuationToken(state, dmGroupId)
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