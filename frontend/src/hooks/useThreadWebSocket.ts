/**
 * useThreadWebSocket Hook
 *
 * Listens for thread-related WebSocket events and updates TanStack Query cache.
 * Should be used in components that display threads.
 */

import { useEffect, useContext } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SocketContext } from "../utils/SocketContext";
import { ServerEvents } from '@kraken/shared';
import {
  threadsControllerGetRepliesQueryKey,
} from "../api-client/@tanstack/react-query.gen";
import type { ThreadRepliesResponseDto } from "../api-client";
import { Message } from "../types/message.type";

interface NewThreadReplyPayload {
  reply: Message;
  parentMessageId: string;
}

interface DeleteThreadReplyPayload {
  parentMessageId: string;
  replyId: string;
}

/**
 * Hook to handle real-time thread updates via WebSocket.
 * Call this in components that display thread replies.
 */
export function useThreadWebSocket() {
  const socket = useContext(SocketContext);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const getRepliesQueryKey = (parentMessageId: string) =>
      threadsControllerGetRepliesQueryKey({
        path: { parentMessageId },
        query: { limit: 50, continuationToken: '' },
      });

    const handleNewThreadReply = async (payload: NewThreadReplyPayload) => {
      const queryKey = getRepliesQueryKey(payload.parentMessageId);
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, (old: ThreadRepliesResponseDto | undefined) => {
        if (!old) return old;
        // Check for duplicates
        if (old.replies.some((r) => r.id === payload.reply.id)) return old;
        return {
          ...old,
          replies: [...old.replies, payload.reply as never],
        };
      });
    };

    const handleUpdateThreadReply = async (payload: NewThreadReplyPayload) => {
      const queryKey = getRepliesQueryKey(payload.parentMessageId);
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, (old: ThreadRepliesResponseDto | undefined) => {
        if (!old) return old;
        return {
          ...old,
          replies: old.replies.map((r) =>
            r.id === payload.reply.id ? (payload.reply as never) : r
          ),
        };
      });
    };

    const handleDeleteThreadReply = async (payload: DeleteThreadReplyPayload) => {
      const queryKey = getRepliesQueryKey(payload.parentMessageId);
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, (old: ThreadRepliesResponseDto | undefined) => {
        if (!old) return old;
        return {
          ...old,
          replies: old.replies.filter((r) => r.id !== payload.replyId),
        };
      });
    };

    socket.on(ServerEvents.NEW_THREAD_REPLY, handleNewThreadReply);
    socket.on(ServerEvents.UPDATE_THREAD_REPLY, handleUpdateThreadReply);
    socket.on(ServerEvents.DELETE_THREAD_REPLY, handleDeleteThreadReply);

    return () => {
      socket.off(ServerEvents.NEW_THREAD_REPLY, handleNewThreadReply);
      socket.off(ServerEvents.UPDATE_THREAD_REPLY, handleUpdateThreadReply);
      socket.off(ServerEvents.DELETE_THREAD_REPLY, handleDeleteThreadReply);
    };
  }, [socket, queryClient]);
}

export default useThreadWebSocket;
