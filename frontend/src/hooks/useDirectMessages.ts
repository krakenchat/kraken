import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { directMessagesControllerGetDmMessagesOptions } from "../api-client/@tanstack/react-query.gen";
import { MESSAGE_STALE_TIME } from "../utils/messageQueryKeys";
import { indexMessages, clearContextIndex } from "../utils/messageIndex";
import type { Message } from "../types/message.type";

export const useDirectMessages = (dmGroupId: string) => {

  // Initial data fetch
  const { data, error, isLoading } = useQuery({
    ...directMessagesControllerGetDmMessagesOptions({ path: { id: dmGroupId } }),
    // WebSocket events keep message data fresh — disable TanStack Query
    // background refetch. Re-fetch only on socket reconnect (invalidateQueries).
    staleTime: MESSAGE_STALE_TIME,
  });

  // Read messages directly from TanStack Query cache
  const messages: Message[] = useMemo(
    () => (data?.messages as unknown as Message[]) ?? [],
    [data?.messages],
  );
  const continuationToken = data?.continuationToken;

  // Index messages for O(1) lookup by messageId → contextId
  useEffect(() => {
    if (messages.length > 0) {
      indexMessages(messages, dmGroupId);
    }
    return () => {
      clearContextIndex(dmGroupId);
    };
  }, [messages, dmGroupId]);

  return {
    messages,
    isLoading,
    error,
    continuationToken,
    isLoadingMore: false, // DMs don't have pagination yet
    onLoadMore: undefined, // DMs don't support pagination yet
  };
};
