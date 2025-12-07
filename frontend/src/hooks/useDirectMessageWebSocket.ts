import { useSocket } from "./useSocket";
import { useEffect, useRef } from "react";
import { ServerEvents } from "../types/server-events.enum";
import { ClientEvents } from "../types/client-events.enum";
import {
  NewMessagePayload,
  UpdateMessagePayload,
  DeleteMessagePayload,
  ReactionAddedPayload,
  ReactionRemovedPayload,
} from "../types/websocket-payloads";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import {
  prependMessage,
  updateMessage,
  deleteMessage,
  selectMessageIndex,
  selectMessagesByContextId,
} from "../features/messages/messagesSlice";
import { logger } from "../utils/logger";

export function useDirectMessageWebSocket() {
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
    if (!socket) return;

    const handleNewDM = ({ message }: NewMessagePayload) => {
      logger.dev("[useDirectMessageWebSocket] Received NEW_DM event:", message);
      const contextId = message.directMessageGroupId;
      if (contextId) {
        logger.dev("[useDirectMessageWebSocket] Adding message to DM group:", contextId);
        dispatch(prependMessage({ contextId, message }));
      } else {
        logger.warn("[useDirectMessageWebSocket] No directMessageGroupId in message:", message);
      }
    };

    const handleUpdateMessage = ({ message }: UpdateMessagePayload) => {
      const contextId = message.directMessageGroupId;
      if (contextId) {
        dispatch(updateMessage({ contextId, message }));
      }
    };

    const handleDeleteMessage = ({
      messageId,
      directMessageGroupId,
    }: DeleteMessagePayload) => {
      if (directMessageGroupId) {
        dispatch(deleteMessage({ contextId: directMessageGroupId, id: messageId }));
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
      const messageToUpdate = messages.find(msg => msg.id === messageId);

      if (messageToUpdate && messageToUpdate.directMessageGroupId) {
        const updatedReactions = [...messageToUpdate.reactions];
        const existingIndex = updatedReactions.findIndex(r => r.emoji === reaction.emoji);

        if (existingIndex >= 0) {
          updatedReactions[existingIndex] = reaction;
        } else {
          updatedReactions.push(reaction);
        }

        dispatch(updateMessage({
          contextId,
          message: { ...messageToUpdate, reactions: updatedReactions }
        }));
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
      const messageToUpdate = messages.find(msg => msg.id === messageId);

      if (messageToUpdate && messageToUpdate.directMessageGroupId) {
        dispatch(updateMessage({
          contextId,
          message: { ...messageToUpdate, reactions }
        }));
      }
    };

    // Listen to DM-specific events
    socket.on(ServerEvents.NEW_DM, handleNewDM);
    socket.on(ServerEvents.UPDATE_MESSAGE, handleUpdateMessage);
    socket.on(ServerEvents.DELETE_MESSAGE, handleDeleteMessage);
    socket.on(ServerEvents.REACTION_ADDED, handleReactionAdded);
    socket.on(ServerEvents.REACTION_REMOVED, handleReactionRemoved);
    
    return () => {
      socket.off(ServerEvents.NEW_DM, handleNewDM);
      socket.off(ServerEvents.UPDATE_MESSAGE, handleUpdateMessage);
      socket.off(ServerEvents.DELETE_MESSAGE, handleDeleteMessage);
      socket.off(ServerEvents.REACTION_ADDED, handleReactionAdded);
      socket.off(ServerEvents.REACTION_REMOVED, handleReactionRemoved);
    };
  }, [socket, dispatch]); // Using refs for latest state without re-triggering effect

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