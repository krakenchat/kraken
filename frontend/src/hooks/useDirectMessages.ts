import React, { useCallback, useState } from "react";
import { useSelector } from "react-redux";
import { useGetDmMessagesQuery } from "../features/directMessages/directMessagesApiSlice";
import { makeSelectMessagesByChannel } from "../features/messages/messagesSlice";
import { useDirectMessageWebSocket } from "./useDirectMessageWebSocket";
import type { RootState } from "../app/store";
import type { Message } from "../types/message.type";

export const useDirectMessages = (dmGroupId: string) => {
  const [isLoadingMore] = useState(false); // DMs don't have pagination yet
  
  // WebSocket connection for DMs
  const { joinDmGroup, leaveDmGroup } = useDirectMessageWebSocket();

  // Initial data fetch
  const { data: dmMessagesData, error, isLoading } = useGetDmMessagesQuery(dmGroupId);

  // Get WebSocket messages from Redux state
  const selectMessagesByChannel = React.useMemo(
    () => makeSelectMessagesByChannel(),
    []
  );
  
  const wsMessages = useSelector((state: RootState) =>
    selectMessagesByChannel(state, dmGroupId)
  );
  
  // Combine API messages with WebSocket messages, maintaining newest-first order
  const messages = React.useMemo(() => {
    const apiMessages = dmMessagesData?.messages || [];
    
    // If we have WebSocket messages, they should be newer than API messages
    // WebSocket messages are already in newest-first order from prependMessage
    if (wsMessages && wsMessages.length > 0) {
      // Filter out any WebSocket messages that are already in API messages
      const newWsMessages = wsMessages.filter(wsMessage => 
        !apiMessages.find(apiMsg => apiMsg.id === wsMessage.id)
      );
      
      // Combine: WebSocket messages (newest) first, then API messages
      return [...newWsMessages, ...apiMessages];
    }
    
    // Just API messages, already in newest-first order
    return apiMessages;
  }, [dmMessagesData?.messages, wsMessages]);

  const continuationToken = dmMessagesData?.continuationToken;

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