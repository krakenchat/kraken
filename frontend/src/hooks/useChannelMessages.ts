import { useCallback, useEffect, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { messagesControllerFindAllForChannel } from "../api-client/sdk.gen";
import { channelMessagesQueryKey, MESSAGE_STALE_TIME, MESSAGE_MAX_PAGES } from "../utils/messageQueryKeys";
import { indexMessages, clearContextIndex } from "../utils/messageIndex";
import type { Message } from "../types/message.type";

export const useChannelMessages = (channelId: string) => {
  const queryKey = channelMessagesQueryKey(channelId);

  const {
    data,
    error,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await messagesControllerFindAllForChannel({
        path: { channelId },
        query: { limit: 25, continuationToken: pageParam },
        throwOnError: true,
        signal,
      });
      return data;
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.continuationToken || undefined,
    // WebSocket events keep message data fresh — disable TanStack Query
    // background refetch. Re-fetch only on socket reconnect (invalidateQueries).
    staleTime: MESSAGE_STALE_TIME,
    maxPages: MESSAGE_MAX_PAGES,
    enabled: !!channelId,
  });

  // Flatten pages into a single messages array
  const messages: Message[] = useMemo(
    () => data?.pages.flatMap(page => page.messages) as unknown as Message[] ?? [],
    [data],
  );

  // Index messages for O(1) lookup by messageId → contextId
  useEffect(() => {
    if (messages.length > 0) {
      indexMessages(messages, channelId);
    }
    return () => {
      clearContextIndex(channelId);
    };
  }, [messages, channelId]);

  const handleLoadMore = useCallback(async () => {
    if (!isFetchingNextPage && hasNextPage) {
      await fetchNextPage();
    }
  }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

  // Derive continuationToken from last page for backward compatibility
  const continuationToken = data?.pages[data.pages.length - 1]?.continuationToken;

  return {
    messages,
    isLoading,
    error,
    continuationToken,
    isLoadingMore: isFetchingNextPage,
    onLoadMore: handleLoadMore,
  };
};
