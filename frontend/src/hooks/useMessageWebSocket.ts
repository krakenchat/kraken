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
import { messageQueryKeyForContext, channelMessagesQueryKey } from "../utils/messageQueryKeys";
import {
  readReceiptsControllerGetUnreadCountsQueryKey,
  userControllerGetProfileQueryKey,
} from "../api-client/@tanstack/react-query.gen";
import type { UnreadCountDto, UserControllerGetProfileResponse } from "../api-client";
import {
  prependMessageToInfinite,
  updateMessageInInfinite,
  deleteMessageFromInfinite,
  findMessageInInfinite,
} from "../utils/messageCacheUpdaters";

/**
 * Unified WebSocket hook for both channel and DM message events.
 * Handles NEW_MESSAGE, NEW_DM, UPDATE_MESSAGE, DELETE_MESSAGE, reactions,
 * pins, thread reply counts, read receipts, and reconnect invalidation.
 */
export function useMessageWebSocket() {
  const socket = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = async ({ message }: NewMessagePayload) => {
      const queryKey = messageQueryKeyForContext(message);
      if (!queryKey) return;
      const contextId = message.channelId || message.directMessageGroupId;
      if (!contextId) return;

      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, (old: unknown) =>
        prependMessageToInfinite(old as never, message as Message)
      );

      // Increment unread count — skip for own messages
      const currentUser = queryClient.getQueryData<UserControllerGetProfileResponse>(
        userControllerGetProfileQueryKey()
      );
      if (currentUser && message.authorId === currentUser.id) return;

      const unreadQueryKey = readReceiptsControllerGetUnreadCountsQueryKey();
      queryClient.setQueryData(unreadQueryKey, (old: UnreadCountDto[] | undefined) => {
        if (!old) return old;
        const index = old.findIndex(
          (c) => (c.channelId || c.directMessageGroupId) === contextId
        );
        if (index >= 0) {
          const next = [...old];
          next[index] = { ...next[index], unreadCount: next[index].unreadCount + 1 };
          return next;
        }
        return [
          ...old,
          {
            channelId: message.channelId || undefined,
            directMessageGroupId: message.directMessageGroupId || undefined,
            unreadCount: 1,
            mentionCount: 0,
          },
        ];
      });
    };

    const handleUpdateMessage = async ({ message }: UpdateMessagePayload) => {
      const queryKey = messageQueryKeyForContext(message);
      if (!queryKey) return;
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
      const queryKey = messageQueryKeyForContext({ channelId, directMessageGroupId });
      if (!queryKey) return;
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, (old: unknown) =>
        deleteMessageFromInfinite(old as never, messageId)
      );
    };

    const handleReactionAdded = async ({
      messageId,
      reaction,
      channelId,
      directMessageGroupId,
    }: ReactionAddedPayload) => {
      const queryKey = messageQueryKeyForContext({ channelId, directMessageGroupId });
      if (!queryKey) return;

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
      channelId,
      directMessageGroupId,
    }: ReactionRemovedPayload) => {
      const queryKey = messageQueryKeyForContext({ channelId, directMessageGroupId });
      if (!queryKey) return;

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
      const queryKey = channelMessagesQueryKey(channelId);
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
      const queryKey = channelMessagesQueryKey(channelId);
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
      channelId,
      directMessageGroupId,
    }: ThreadReplyCountUpdatedPayload) => {
      const queryKey = messageQueryKeyForContext({ channelId, directMessageGroupId });
      if (!queryKey) return;

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
          mentionCount: 0,
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

    // After reconnect, invalidate all message queries to catch up
    const handleReconnect = () => {
      queryClient.invalidateQueries({
        queryKey: [{ _id: 'messagesControllerFindAllForChannel' }],
      });
      queryClient.invalidateQueries({
        queryKey: [{ _id: 'messagesControllerFindAllForGroup' }],
      });
      queryClient.invalidateQueries({
        queryKey: readReceiptsControllerGetUnreadCountsQueryKey(),
      });
    };

    // Channel events
    socket.on(ServerEvents.NEW_MESSAGE, handleNewMessage);
    socket.on(ServerEvents.UPDATE_MESSAGE, handleUpdateMessage);
    socket.on(ServerEvents.DELETE_MESSAGE, handleDeleteMessage);
    socket.on(ServerEvents.REACTION_ADDED, handleReactionAdded);
    socket.on(ServerEvents.REACTION_REMOVED, handleReactionRemoved);
    socket.on(ServerEvents.MESSAGE_PINNED, handleMessagePinned);
    socket.on(ServerEvents.MESSAGE_UNPINNED, handleMessageUnpinned);
    socket.on(ServerEvents.THREAD_REPLY_COUNT_UPDATED, handleThreadReplyCountUpdated);
    socket.on(ServerEvents.READ_RECEIPT_UPDATED, handleReadReceiptUpdated);

    // DM events — reuse the same handler since the payload shape is identical
    socket.on(ServerEvents.NEW_DM, handleNewMessage);

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
      socket.off(ServerEvents.NEW_DM, handleNewMessage);
      socket.off('connect', handleReconnect);
    };
  }, [socket, queryClient]);
}
