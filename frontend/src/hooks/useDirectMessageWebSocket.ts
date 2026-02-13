import { useSocket } from "./useSocket";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ServerEvents,
  ClientEvents,
  NewMessagePayload,
  UpdateMessagePayload,
  DeleteMessagePayload,
  ReactionAddedPayload,
  ReactionRemovedPayload,
} from "@kraken/shared";
import type { Message } from "../types/message.type";
import { dmMessagesQueryKey } from "../utils/messageQueryKeys";
import {
  prependMessageToFlat,
  updateMessageInFlat,
  deleteMessageFromFlat,
  findMessageInFlat,
} from "../utils/messageCacheUpdaters";
import {
  setMessageContext,
  getMessageContext,
  removeMessageContext,
} from "../utils/messageIndex";
import { logger } from "../utils/logger";

export function useDirectMessageWebSocket() {
  const socket = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const handleNewDM = async ({ message }: NewMessagePayload) => {
      logger.dev("[useDirectMessageWebSocket] Received NEW_DM event:", message);
      const contextId = message.directMessageGroupId;
      if (contextId) {
        logger.dev("[useDirectMessageWebSocket] Adding message to DM group:", contextId);
        const queryKey = dmMessagesQueryKey(contextId);
        await queryClient.cancelQueries({ queryKey });
        queryClient.setQueryData(queryKey, (old: unknown) =>
          prependMessageToFlat(old as never, message as Message)
        );
        setMessageContext(message.id, contextId);
      } else {
        logger.warn("[useDirectMessageWebSocket] No directMessageGroupId in message:", message);
      }
    };

    const handleUpdateMessage = async ({ message }: UpdateMessagePayload) => {
      const contextId = message.directMessageGroupId;
      if (contextId) {
        const queryKey = dmMessagesQueryKey(contextId);
        await queryClient.cancelQueries({ queryKey });
        queryClient.setQueryData(queryKey, (old: unknown) =>
          updateMessageInFlat(old as never, message as Message)
        );
      }
    };

    const handleDeleteMessage = async ({
      messageId,
      directMessageGroupId,
    }: DeleteMessagePayload) => {
      if (directMessageGroupId) {
        const queryKey = dmMessagesQueryKey(directMessageGroupId);
        await queryClient.cancelQueries({ queryKey });
        queryClient.setQueryData(queryKey, (old: unknown) =>
          deleteMessageFromFlat(old as never, messageId)
        );
        removeMessageContext(messageId);
      }
    };

    const handleReactionAdded = async ({
      messageId,
      reaction,
    }: ReactionAddedPayload) => {
      const contextId = getMessageContext(messageId);
      if (!contextId) return;

      const queryKey = dmMessagesQueryKey(contextId);
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, (old: unknown) => {
        const msg = findMessageInFlat(old as never, messageId);
        if (!msg || !msg.directMessageGroupId) return old;

        const updatedReactions = [...msg.reactions];
        const existingIndex = updatedReactions.findIndex(r => r.emoji === reaction.emoji);

        if (existingIndex >= 0) {
          updatedReactions[existingIndex] = reaction;
        } else {
          updatedReactions.push(reaction);
        }

        return updateMessageInFlat(old as never, { ...msg, reactions: updatedReactions });
      });
    };

    const handleReactionRemoved = async ({
      messageId,
      reactions,
    }: ReactionRemovedPayload) => {
      const contextId = getMessageContext(messageId);
      if (!contextId) return;

      const queryKey = dmMessagesQueryKey(contextId);
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, (old: unknown) => {
        const msg = findMessageInFlat(old as never, messageId);
        if (!msg || !msg.directMessageGroupId) return old;
        return updateMessageInFlat(old as never, { ...msg, reactions });
      });
    };

    // After reconnect, we may have missed WebSocket events while disconnected.
    // Invalidate DM message queries to re-fetch and catch up.
    const handleReconnect = () => {
      queryClient.invalidateQueries({
        queryKey: [{ _id: 'directMessagesControllerGetDmMessages' }],
      });
    };

    socket.on(ServerEvents.NEW_DM, handleNewDM);
    socket.on(ServerEvents.UPDATE_MESSAGE, handleUpdateMessage);
    socket.on(ServerEvents.DELETE_MESSAGE, handleDeleteMessage);
    socket.on(ServerEvents.REACTION_ADDED, handleReactionAdded);
    socket.on(ServerEvents.REACTION_REMOVED, handleReactionRemoved);
    socket.on('connect', handleReconnect);

    return () => {
      socket.off(ServerEvents.NEW_DM, handleNewDM);
      socket.off(ServerEvents.UPDATE_MESSAGE, handleUpdateMessage);
      socket.off(ServerEvents.DELETE_MESSAGE, handleDeleteMessage);
      socket.off(ServerEvents.REACTION_ADDED, handleReactionAdded);
      socket.off(ServerEvents.REACTION_REMOVED, handleReactionRemoved);
      socket.off('connect', handleReconnect);
    };
  }, [socket, queryClient]);

  const joinDmGroup = (dmGroupId: string) => {
    socket?.emit(ClientEvents.JOIN_DM_ROOM, dmGroupId);
  };

  const leaveDmGroup = (dmGroupId: string) => {
    socket?.emit(ClientEvents.LEAVE_ROOM, dmGroupId);
  };

  return {
    joinDmGroup,
    leaveDmGroup
  };
}
