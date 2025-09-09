import { useSocket } from "./useSocket";
import { useEffect } from "react";
import { Message } from "../types/message.type";
import { ServerEvents } from "../types/server-events.enum";
import { ClientEvents } from "../types/client-events.enum";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import {
  prependMessage,
  updateMessage,
  deleteMessage,
} from "../features/messages/messagesSlice";

export function useDirectMessageWebSocket() {
  const dispatch = useAppDispatch();
  const socket = useSocket();
  const messagesByChannelId = useAppSelector((state) => state.messages.byChannelId);

  useEffect(() => {
    if (!socket) return;

    const handleNewDM = ({ message }: { message: Message }) => {
      console.log("[useDirectMessageWebSocket] Received NEW_DM event:", message);
      const targetDmGroupId = message.directMessageGroupId;
      if (targetDmGroupId) {
        console.log("[useDirectMessageWebSocket] Adding message to DM group:", targetDmGroupId);
        dispatch(prependMessage({ channelId: targetDmGroupId, message }));
      } else {
        console.warn("[useDirectMessageWebSocket] No directMessageGroupId in message:", message);
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
      reaction: any;
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
      emoji,
    }: {
      messageId: string;
      emoji: string;
    }) => {
      // Find the message in all DM groups and update it
      Object.keys(messagesByChannelId).forEach((dmGroupId) => {
        const messages = messagesByChannelId[dmGroupId]?.messages || [];
        const messageToUpdate = messages.find(msg => msg.id === messageId);
        if (messageToUpdate && messageToUpdate.directMessageGroupId) {
          const updatedReactions = messageToUpdate.reactions.filter(r => r.emoji !== emoji);
          
          dispatch(updateMessage({
            channelId: dmGroupId,
            message: { ...messageToUpdate, reactions: updatedReactions }
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

  const sendDirectMessage = (dmGroupId: string, spans: any[]) => {
    console.log("[useDirectMessageWebSocket] Preparing to send DM:", { dmGroupId, spans });
    const messageData = {
      directMessageGroupId: dmGroupId,
      spans,
      attachments: [],
    };

    console.log("[useDirectMessageWebSocket] Message data:", messageData);
    console.log("[useDirectMessageWebSocket] Socket connected:", !!socket?.connected);
    console.log("[useDirectMessageWebSocket] Emitting event:", ClientEvents.SEND_DM);
    
    socket?.emit(ClientEvents.SEND_DM, messageData);
    console.log("[useDirectMessageWebSocket] Event emitted");
  };

  const joinDmGroup = (dmGroupId: string) => {
    socket?.emit(ClientEvents.JOIN_ROOM, dmGroupId);
  };

  const leaveDmGroup = (dmGroupId: string) => {
    socket?.emit(ClientEvents.LEAVE_ROOM, dmGroupId);
  };

  return { 
    sendDirectMessage, 
    joinDmGroup, 
    leaveDmGroup 
  };
}