import { useCallback, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { messagesControllerFindAllForChannel, messagesControllerFindAllForGroup } from "../api-client/sdk.gen";
import { channelMessagesQueryKey, dmMessagesQueryKey, MESSAGE_STALE_TIME, MESSAGE_MAX_PAGES } from "../utils/messageQueryKeys";
import type { Message } from "../types/message.type";

export const useMessages = (type: 'channel' | 'dm', id: string | undefined) => {
  const queryKey = type === 'channel'
    ? channelMessagesQueryKey(id || '')
    : dmMessagesQueryKey(id || '');

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
      if (type === 'channel') {
        const { data } = await messagesControllerFindAllForChannel({
          path: { channelId: id! },
          query: { limit: 25, continuationToken: pageParam },
          throwOnError: true,
          signal,
        });
        return data;
      } else {
        const { data } = await messagesControllerFindAllForGroup({
          path: { groupId: id! },
          query: { limit: 25, continuationToken: pageParam },
          throwOnError: true,
          signal,
        });
        return data;
      }
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.continuationToken || undefined,
    staleTime: MESSAGE_STALE_TIME,
    maxPages: MESSAGE_MAX_PAGES,
    enabled: !!id,
  });

  const messages: Message[] = useMemo(
    () => data?.pages.flatMap(page => page.messages) as unknown as Message[] ?? [],
    [data],
  );

  const handleLoadMore = useCallback(async () => {
    if (!isFetchingNextPage && hasNextPage) {
      await fetchNextPage();
    }
  }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

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
