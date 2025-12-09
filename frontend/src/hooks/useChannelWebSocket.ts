import { useSocket } from "./useSocket";
import { useEffect, useRef } from "react";
import { Message } from "../types/message.type";
import { ServerEvents } from "../types/server-events.enum";
import { ClientEvents } from "../types/client-events.enum";
import {
  NewMessagePayload,
  UpdateMessagePayload,
  DeleteMessagePayload,
  ReactionAddedPayload,
  ReactionRemovedPayload,
  MessagePinnedPayload,
  MessageUnpinnedPayload,
  ThreadReplyCountUpdatedPayload,
} from "../types/websocket-payloads";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import {
  prependMessage,
  updateMessage,
  deleteMessage,
  selectMessageIndex,
  selectMessagesByContextId,
} from "../features/messages/messagesSlice";

export function useChannelWebSocket(communityId: string | undefined) {
  const dispatch = useAppDispatch();
  const socket = useSocket();
  const messagesByContextId = useAppSelector(selectMessagesByContextId);
  const messageIndex = useAppSelector(selectMessageIndex);

  // Use refs to access latest state without triggering effect re-runs
  const messagesByContextIdRef = useRef(messagesByContextId);
  messagesByContextIdRef.current = messagesByContextId;
  const messageIndexRef = useRef(messageIndex);
  messageIndexRef.current = messageIndex;

  useEffect(() => {
    if (!socket || !communityId) return;
    // No need to join/leave community here; handled by useCommunityJoin

    const handleNewMessage = ({ message }: NewMessagePayload) => {
      const contextId = message.channelId || message.directMessageGroupId;
      if (contextId) {
        dispatch(prependMessage({ contextId, message }));
      }
    };
    const handleUpdateMessage = ({ message }: UpdateMessagePayload) => {
      const contextId = message.channelId || message.directMessageGroupId;
      if (contextId) {
        dispatch(updateMessage({ contextId, message }));
      }
    };
    const handleDeleteMessage = ({
      messageId,
      channelId,
      directMessageGroupId,
    }: DeleteMessagePayload) => {
      const contextId = channelId || directMessageGroupId;
      if (contextId) {
        dispatch(deleteMessage({ contextId, id: messageId }));
      }
    };

    const handleReactionAdded = ({
      messageId,
      reaction,
    }: ReactionAddedPayload) => {
      // O(1) lookup using message index
      const contextId = messageIndexRef.current[messageId];
      if (!contextId) return;

      const currentMessages = messagesByContextIdRef.current;
      const messages = currentMessages[contextId]?.messages || [];
      const messageToUpdate = messages.find((msg) => msg.id === messageId);

      if (messageToUpdate) {
        const updatedReactions = [...messageToUpdate.reactions];
        const existingIndex = updatedReactions.findIndex(
          (r) => r.emoji === reaction.emoji
        );

        if (existingIndex >= 0) {
          updatedReactions[existingIndex] = reaction;
        } else {
          updatedReactions.push(reaction);
        }

        dispatch(
          updateMessage({
            contextId,
            message: { ...messageToUpdate, reactions: updatedReactions },
          })
        );
      }
    };

    const handleReactionRemoved = ({
      messageId,
      reactions,
    }: ReactionRemovedPayload) => {
      // O(1) lookup using message index
      const contextId = messageIndexRef.current[messageId];
      if (!contextId) return;

      const currentMessages = messagesByContextIdRef.current;
      const messages = currentMessages[contextId]?.messages || [];
      const messageToUpdate = messages.find((msg) => msg.id === messageId);

      if (messageToUpdate) {
        dispatch(
          updateMessage({
            contextId,
            message: { ...messageToUpdate, reactions },
          })
        );
      }
    };

    const handleMessagePinned = ({
      messageId,
      channelId,
      pinnedBy,
      pinnedAt,
    }: MessagePinnedPayload) => {
      // channelId from payload is the context ID for pinned messages
      const contextId = channelId;
      const currentMessages = messagesByContextIdRef.current;
      const messages = currentMessages[contextId]?.messages || [];
      const messageToUpdate = messages.find((msg) => msg.id === messageId);

      if (messageToUpdate) {
        dispatch(
          updateMessage({
            contextId,
            message: { ...messageToUpdate, pinned: true, pinnedBy, pinnedAt },
          })
        );
      }
    };

    const handleMessageUnpinned = ({
      messageId,
      channelId,
    }: MessageUnpinnedPayload) => {
      // channelId from payload is the context ID for pinned messages
      const contextId = channelId;
      const currentMessages = messagesByContextIdRef.current;
      const messages = currentMessages[contextId]?.messages || [];
      const messageToUpdate = messages.find((msg) => msg.id === messageId);

      if (messageToUpdate) {
        dispatch(
          updateMessage({
            contextId,
            message: {
              ...messageToUpdate,
              pinned: false,
              pinnedBy: null,
              pinnedAt: null,
            },
          })
        );
      }
    };

    const handleThreadReplyCountUpdated = ({
      parentMessageId,
      replyCount,
      lastReplyAt,
    }: ThreadReplyCountUpdatedPayload) => {
      // O(1) lookup using message index
      const contextId = messageIndexRef.current[parentMessageId];
      if (!contextId) return;

      const currentMessages = messagesByContextIdRef.current;
      const messages = currentMessages[contextId]?.messages || [];
      const messageToUpdate = messages.find((msg) => msg.id === parentMessageId);

      if (messageToUpdate) {
        dispatch(
          updateMessage({
            contextId,
            message: {
              ...messageToUpdate,
              replyCount,
              lastReplyAt,
            },
          })
        );
      }
    };

    socket.on(ServerEvents.NEW_MESSAGE, handleNewMessage);
    socket.on(ServerEvents.UPDATE_MESSAGE, handleUpdateMessage);
    socket.on(ServerEvents.DELETE_MESSAGE, handleDeleteMessage);
    socket.on(ServerEvents.REACTION_ADDED, handleReactionAdded);
    socket.on(ServerEvents.REACTION_REMOVED, handleReactionRemoved);
    socket.on(ServerEvents.MESSAGE_PINNED, handleMessagePinned);
    socket.on(ServerEvents.MESSAGE_UNPINNED, handleMessageUnpinned);
    socket.on(ServerEvents.THREAD_REPLY_COUNT_UPDATED, handleThreadReplyCountUpdated);

    return () => {
      socket.off(ServerEvents.NEW_MESSAGE, handleNewMessage);
      socket.off(ServerEvents.UPDATE_MESSAGE, handleUpdateMessage);
      socket.off(ServerEvents.DELETE_MESSAGE, handleDeleteMessage);
      socket.off(ServerEvents.REACTION_ADDED, handleReactionAdded);
      socket.off(ServerEvents.REACTION_REMOVED, handleReactionRemoved);
      socket.off(ServerEvents.MESSAGE_PINNED, handleMessagePinned);
      socket.off(ServerEvents.MESSAGE_UNPINNED, handleMessageUnpinned);
      socket.off(ServerEvents.THREAD_REPLY_COUNT_UPDATED, handleThreadReplyCountUpdated);
    };
  }, [socket, communityId, dispatch]); // Using refs for latest state without re-triggering effect

  const sendMessage = (msg: Omit<Message, "id">) => {
    // @ts-expect-error: id will be assigned by the server
    socket.emit(ClientEvents.SEND_MESSAGE, msg);
  };

  return { sendMessage };
}
