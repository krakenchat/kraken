import { useSocket } from "./useSocket";
import { useEffect } from "react";
import { Message, Reaction } from "../types/message.type";
import { ServerEvents } from "../types/server-events.enum";
import { ClientEvents } from "../types/client-events.enum";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import {
  prependMessage,
  updateMessage,
  deleteMessage,
} from "../features/messages/messagesSlice";
import { logger } from "../utils/logger";

export function useDirectMessageWebSocket() {
  const dispatch = useAppDispatch();
  const socket = useSocket();
  const messagesByChannelId = useAppSelector((state) => state.messages.byChannelId);

  useEffect(() => {
    if (!socket) return;

    const handleNewDM = ({ message }: { message: Message }) => {
      logger.dev("[useDirectMessageWebSocket] Received NEW_DM event:", message);
      const targetDmGroupId = message.directMessageGroupId;
      if (targetDmGroupId) {
        logger.dev("[useDirectMessageWebSocket] Adding message to DM group:", targetDmGroupId);
        dispatch(prependMessage({ channelId: targetDmGroupId, message }));
      } else {
        logger.warn("[useDirectMessageWebSocket] No directMessageGroupId in message:", message);
      }
    };

    const handleUpdateMessage = ({ message }: { message: Message }) => {
      const targetDmGroupId = message.directMessageGroupId;
      if (targetDmGroupId) {
        dispatch(updateMessage({ channelId: targetDmGroupId, message }));
      }
    };

    const handleDeleteMessage = ({
      messageId,
      directMessageGroupId,
    }: {
      messageId: string;
      channelId?: string | null;
      directMessageGroupId?: string | null;
    }) => {
      if (directMessageGroupId) {
        dispatch(deleteMessage({ channelId: directMessageGroupId, id: messageId }));
      }
    };

    const handleReactionAdded = ({
      messageId,
      reaction,
    }: {
      messageId: string;
      reaction: Reaction;
    }) => {
      // Find the message in all DM groups and update it
      Object.keys(messagesByChannelId).forEach((dmGroupId) => {
        const messages = messagesByChannelId[dmGroupId]?.messages || [];
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
            channelId: dmGroupId,
            message: { ...messageToUpdate, reactions: updatedReactions }
          }));
        }
      });
    };

    const handleReactionRemoved = ({
      messageId,
      reactions,
    }: {
      messageId: string;
      emoji: string;
      reactions: Reaction[];
    }) => {
      // Find the message in all DM groups and update it with the correct reactions array
      Object.keys(messagesByChannelId).forEach((dmGroupId) => {
        const messages = messagesByChannelId[dmGroupId]?.messages || [];
        const messageToUpdate = messages.find(msg => msg.id === messageId);
        if (messageToUpdate && messageToUpdate.directMessageGroupId) {
          dispatch(updateMessage({
            channelId: dmGroupId,
            message: { ...messageToUpdate, reactions }
          }));
        }
      });
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
  }, [socket, dispatch, messagesByChannelId]);

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