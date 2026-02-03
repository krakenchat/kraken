import React, { useCallback, useState } from "react";
import { logger } from "../utils/logger";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  useGetMessagesByChannelQuery,
  useLazyGetMessagesByChannelQuery,
} from "../features/messages/messagesApiSlice";
import {
  makeSelectMessagesByContext,
  makeSelectContinuationTokenByContext,
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

  // Memoized selectors for this specific channel (contextId = channelId)
  const selectMessages = React.useMemo(
    () => makeSelectMessagesByContext(),
    []
  );
  const selectContinuationToken = React.useMemo(
    () => makeSelectContinuationTokenByContext(),
    []
  );

  // Get messages from Redux store
  const messages: Message[] = useSelector((state: RootState) =>
    selectMessages(state, channelId)
  );
  const continuationToken = useSelector((state: RootState) =>
    selectContinuationToken(state, channelId)
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
      logger.error("Failed to load more messages:", error);
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