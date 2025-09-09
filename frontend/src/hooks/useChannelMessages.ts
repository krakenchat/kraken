import React, { useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  useGetMessagesByChannelQuery,
  useLazyGetMessagesByChannelQuery,
} from "../features/messages/messagesApiSlice";
import {
  makeSelectMessagesByChannel,
  makeSelectContinuationTokenByChannel,
} from "../features/messages/messagesSlice";
import { useChannelWebSocket } from "./useChannelWebSocket";
import type { RootState } from "../app/store";
import type { Message } from "../types/message.type";

export const useChannelMessages = (channelId: string) => {
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // WebSocket connection
  const { communityId } = useParams<{ communityId: string }>();
  useChannelWebSocket(communityId);

  // Initial data fetch
  const { error, isLoading } = useGetMessagesByChannelQuery({ channelId });

  // Memoized selectors for this specific channel
  const selectMessagesByChannel = React.useMemo(
    () => makeSelectMessagesByChannel(),
    []
  );
  const selectContinuationTokenByChannel = React.useMemo(
    () => makeSelectContinuationTokenByChannel(),
    []
  );

  // Get messages from Redux store
  const messages: Message[] = useSelector((state: RootState) =>
    selectMessagesByChannel(state, channelId)
  );
  const continuationToken = useSelector((state: RootState) =>
    selectContinuationTokenByChannel(state, channelId)
  );

  // Lazy query for pagination
  const [loadMoreMessages] = useLazyGetMessagesByChannelQuery();

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !continuationToken) {
      return;
    }

    setIsLoadingMore(true);

    try {
      await loadMoreMessages({
        channelId,
        continuationToken,
        limit: 25,
      }).unwrap();
    } catch (error) {
      console.error("Failed to load more messages:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [channelId, continuationToken, isLoadingMore, loadMoreMessages]);

  return {
    messages,
    isLoading,
    error,
    continuationToken,
    isLoadingMore,
    onLoadMore: handleLoadMore,
  };
};