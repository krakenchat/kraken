import React, { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { messagesControllerFindAllForChannelOptions } from "../api-client/@tanstack/react-query.gen";
import { logger } from "../utils/logger";
import { useParams } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  setMessages,
  appendMessages,
  makeSelectMessagesByContext,
  makeSelectContinuationTokenByContext,
} from "../features/messages/messagesSlice";
import { useChannelWebSocket } from "./useChannelWebSocket";
import type { RootState } from "../app/store";
import type { Message } from "../types/message.type";

export const useChannelMessages = (channelId: string) => {
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  // WebSocket connection
  const { communityId } = useParams<{ communityId: string }>();
  useChannelWebSocket(communityId);

  // Initial data fetch via TanStack Query
  const { data, error, isLoading } = useQuery({
    ...messagesControllerFindAllForChannelOptions({ path: { channelId }, query: { limit: 25, continuationToken: '' } }),
    enabled: !!channelId,
  });

  // Dispatch initial data to Redux messagesSlice
  useEffect(() => {
    if (data) {
      dispatch(setMessages({
        contextId: channelId,
        messages: data.messages as Message[],
        continuationToken: data.continuationToken,
      }));
    }
  }, [data, channelId, dispatch]);

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

  // Paginated load via queryClient.fetchQuery
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !continuationToken) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const moreData = await queryClient.fetchQuery(
        messagesControllerFindAllForChannelOptions({
          path: { channelId },
          query: { limit: 25, continuationToken },
        })
      );
      dispatch(appendMessages({
        contextId: channelId,
        messages: moreData.messages as Message[],
        continuationToken: moreData.continuationToken,
      }));
    } catch (error) {
      logger.error("Failed to load more messages:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [channelId, continuationToken, isLoadingMore, queryClient, dispatch]);

  return {
    messages,
    isLoading,
    error,
    continuationToken,
    isLoadingMore,
    onLoadMore: handleLoadMore,
  };
};