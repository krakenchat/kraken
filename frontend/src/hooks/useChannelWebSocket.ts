import { useSocket } from "./useSocket";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Message } from "../types/message.type";
import {
  ServerEvents,
  NewMessagePayload,
  UpdateMessagePayload,
  DeleteMessagePayload,
  ReactionAddedPayload,
  ReactionRemovedPayload,
  MessagePinnedPayload,
  MessageUnpinnedPayload,
  ThreadReplyCountUpdatedPayload,
  ReadReceiptUpdatedPayload,
} from "@kraken/shared";
import { channelMessagesQueryKey } from "../utils/messageQueryKeys";
import { readReceiptsControllerGetUnreadCountsQueryKey } from "../api-client/@tanstack/react-query.gen";
import type { UnreadCountDto } from "../api-client";
import {
  prependMessageToInfinite,
  updateMessageInInfinite,
  deleteMessageFromInfinite,
  findMessageInInfinite,
} from "../utils/messageCacheUpdaters";
import {
  setMessageContext,
  getMessageContext,
  removeMessageContext,
} from "../utils/messageIndex";

export function useChannelWebSocket() {
  const socket = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = async ({ message }: NewMessagePayload) => {
      const contextId = message.channelId || message.directMessageGroupId;
      if (!contextId) return;
      const queryKey = channelMessagesQueryKey(contextId);
      // Cancel in-flight fetchNextPage to prevent it from overwriting this
      // WebSocket update when it resolves. See: TanStack Query issue #3579
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, (old: unknown) =>
        prependMessageToInfinite(old as never, message as Message)
      );
      setMessageContext(message.id, contextId);
    };

    const handleUpdateMessage = async ({ message }: UpdateMessagePayload) => {
      const contextId = message.channelId || message.directMessageGroupId;
      if (!contextId) return;
      const queryKey = channelMessagesQueryKey(contextId);
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, (old: unknown) =>
        updateMessageInInfinite(old as never, message as Message)
      );
    };

    const handleDeleteMessage = async ({
      messageId,
      channelId,
      directMessageGroupId,
    }: DeleteMessagePayload) => {
      const contextId = channelId || directMessageGroupId;
      if (!contextId) return;
      const queryKey = channelMessagesQueryKey(contextId);
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, (old: unknown) =>
        deleteMessageFromInfinite(old as never, messageId)
      );
      removeMessageContext(messageId);
    };

    const handleReactionAdded = async ({
      messageId,
      reaction,
    }: ReactionAddedPayload) => {
      const contextId = getMessageContext(messageId);
      if (!contextId) return;

      const queryKey = channelMessagesQueryKey(contextId);
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, (old: unknown) => {
        const msg = findMessageInInfinite(old as never, messageId);
        if (!msg) return old;

        const updatedReactions = [...msg.reactions];
        const existingIndex = updatedReactions.findIndex(
          (r) => r.emoji === reaction.emoji
        );
        if (existingIndex >= 0) {
          updatedReactions[existingIndex] = reaction;
        } else {
          updatedReactions.push(reaction);
        }

        return updateMessageInInfinite(old as never, {
          ...msg,
          reactions: updatedReactions,
        });
      });
    };

    const handleReactionRemoved = async ({
      messageId,
      reactions,
    }: ReactionRemovedPayload) => {
      const contextId = getMessageContext(messageId);
      if (!contextId) return;

      const queryKey = channelMessagesQueryKey(contextId);
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, (old: unknown) => {
        const msg = findMessageInInfinite(old as never, messageId);
        if (!msg) return old;
        return updateMessageInInfinite(old as never, {
          ...msg,
          reactions,
        });
      });
    };

    const handleMessagePinned = async ({
      messageId,
      channelId,
      pinnedBy,
      pinnedAt,
    }: MessagePinnedPayload) => {
      const contextId = channelId;
      const queryKey = channelMessagesQueryKey(contextId);
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, (old: unknown) => {
        const msg = findMessageInInfinite(old as never, messageId);
        if (!msg) return old;
        return updateMessageInInfinite(old as never, {
          ...msg,
          pinned: true,
          pinnedBy,
          pinnedAt,
        });
      });
    };

    const handleMessageUnpinned = async ({
      messageId,
      channelId,
    }: MessageUnpinnedPayload) => {
      const contextId = channelId;
      const queryKey = channelMessagesQueryKey(contextId);
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, (old: unknown) => {
        const msg = findMessageInInfinite(old as never, messageId);
        if (!msg) return old;
        return updateMessageInInfinite(old as never, {
          ...msg,
          pinned: false,
          pinnedBy: null,
          pinnedAt: null,
        });
      });
    };

    const handleThreadReplyCountUpdated = async ({
      parentMessageId,
      replyCount,
      lastReplyAt,
    }: ThreadReplyCountUpdatedPayload) => {
      const contextId = getMessageContext(parentMessageId);
      if (!contextId) return;

      const queryKey = channelMessagesQueryKey(contextId);
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, (old: unknown) => {
        const msg = findMessageInInfinite(old as never, parentMessageId);
        if (!msg) return old;
        return updateMessageInInfinite(old as never, {
          ...msg,
          replyCount,
          lastReplyAt,
        });
      });
    };

    const handleReadReceiptUpdated = ({
      channelId,
      directMessageGroupId,
      lastReadMessageId,
    }: ReadReceiptUpdatedPayload) => {
      const id = channelId || directMessageGroupId;
      if (!id) return;
      const queryKey = readReceiptsControllerGetUnreadCountsQueryKey();
      queryClient.setQueryData(queryKey, (old: UnreadCountDto[] | undefined) => {
        if (!old) return old;
        const updated: UnreadCountDto = {
          channelId: channelId || undefined,
          directMessageGroupId: directMessageGroupId || undefined,
          unreadCount: 0,
          lastReadMessageId,
          lastReadAt: new Date().toISOString(),
        };
        const index = old.findIndex(
          (c) => (c.channelId || c.directMessageGroupId) === id
        );
        if (index >= 0) {
          const next = [...old];
          next[index] = updated;
          return next;
        }
        return [...old, updated];
      });
    };

    // After reconnect, we may have missed WebSocket events while disconnected.
    // Invalidate message queries to re-fetch and catch up.
    const handleReconnect = () => {
      queryClient.invalidateQueries({
        queryKey: [{ _id: 'messagesControllerFindAllForChannel' }],
      });
    };

    socket.on(ServerEvents.NEW_MESSAGE, handleNewMessage);
    socket.on(ServerEvents.UPDATE_MESSAGE, handleUpdateMessage);
    socket.on(ServerEvents.DELETE_MESSAGE, handleDeleteMessage);
    socket.on(ServerEvents.REACTION_ADDED, handleReactionAdded);
    socket.on(ServerEvents.REACTION_REMOVED, handleReactionRemoved);
    socket.on(ServerEvents.MESSAGE_PINNED, handleMessagePinned);
    socket.on(ServerEvents.MESSAGE_UNPINNED, handleMessageUnpinned);
    socket.on(ServerEvents.THREAD_REPLY_COUNT_UPDATED, handleThreadReplyCountUpdated);
    socket.on(ServerEvents.READ_RECEIPT_UPDATED, handleReadReceiptUpdated);
    socket.on('connect', handleReconnect);

    return () => {
      socket.off(ServerEvents.NEW_MESSAGE, handleNewMessage);
      socket.off(ServerEvents.UPDATE_MESSAGE, handleUpdateMessage);
      socket.off(ServerEvents.DELETE_MESSAGE, handleDeleteMessage);
      socket.off(ServerEvents.REACTION_ADDED, handleReactionAdded);
      socket.off(ServerEvents.REACTION_REMOVED, handleReactionRemoved);
      socket.off(ServerEvents.MESSAGE_PINNED, handleMessagePinned);
      socket.off(ServerEvents.MESSAGE_UNPINNED, handleMessageUnpinned);
      socket.off(ServerEvents.THREAD_REPLY_COUNT_UPDATED, handleThreadReplyCountUpdated);
      socket.off(ServerEvents.READ_RECEIPT_UPDATED, handleReadReceiptUpdated);
      socket.off('connect', handleReconnect);
    };
  }, [socket, queryClient]);
}
