import { useSocket } from "./useSocket";
import { useEffect, useRef } from "react";
import { Message, Reaction } from "../types/message.type";
import { ServerEvents } from "../types/server-events.enum";
import { ClientEvents } from "../types/client-events.enum";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import {
  prependMessage,
  updateMessage,
  deleteMessage,
  selectMessageIndex,
} from "../features/messages/messagesSlice";

export function useChannelWebSocket(communityId: string | undefined) {
  const dispatch = useAppDispatch();
  const socket = useSocket();
  const messagesByChannelId = useAppSelector((state) => state.messages.byChannelId);
  const messageIndex = useAppSelector(selectMessageIndex);

  // Use refs to access latest state without triggering effect re-runs
  const messagesByChannelIdRef = useRef(messagesByChannelId);
  messagesByChannelIdRef.current = messagesByChannelId;
  const messageIndexRef = useRef(messageIndex);
  messageIndexRef.current = messageIndex;

  useEffect(() => {
    if (!socket || !communityId) return;
    // No need to join/leave community here; handled by useCommunityJoin

    const handleNewMessage = ({ message }: { message: Message }) => {
      const targetChannelId = message.channelId || message.directMessageGroupId;
      if (targetChannelId) {
        dispatch(prependMessage({ channelId: targetChannelId, message }));
      }
    };
    const handleUpdateMessage = ({ message }: { message: Message }) => {
      const targetChannelId = message.channelId || message.directMessageGroupId;
      if (targetChannelId) {
        dispatch(updateMessage({ channelId: targetChannelId, message }));
      }
    };
    const handleDeleteMessage = ({
      messageId,
      channelId,
      directMessageGroupId,
    }: {
      messageId: string;
      channelId?: string | null;
      directMessageGroupId?: string | null;
    }) => {
      const targetChannelId = channelId || directMessageGroupId;
      if (targetChannelId) {
        dispatch(deleteMessage({ channelId: targetChannelId, id: messageId }));
      }
    };

    const handleReactionAdded = ({
      messageId,
      reaction,
    }: {
      messageId: string;
      reaction: Reaction;
    }) => {
      // O(1) lookup using message index
      const channelId = messageIndexRef.current[messageId];
      if (!channelId) return;

      const currentMessages = messagesByChannelIdRef.current;
      const messages = currentMessages[channelId]?.messages || [];
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
            channelId,
            message: { ...messageToUpdate, reactions: updatedReactions },
          })
        );
      }
    };

    const handleReactionRemoved = ({
      messageId,
      reactions,
    }: {
      messageId: string;
      emoji: string;
      reactions: Reaction[];
    }) => {
      // O(1) lookup using message index
      const channelId = messageIndexRef.current[messageId];
      if (!channelId) return;

      const currentMessages = messagesByChannelIdRef.current;
      const messages = currentMessages[channelId]?.messages || [];
      const messageToUpdate = messages.find((msg) => msg.id === messageId);

      if (messageToUpdate) {
        dispatch(
          updateMessage({
            channelId,
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
    }: {
      messageId: string;
      channelId: string;
      pinnedBy: string;
      pinnedAt: string;
    }) => {
      const currentMessages = messagesByChannelIdRef.current;
      const messages = currentMessages[channelId]?.messages || [];
      const messageToUpdate = messages.find((msg) => msg.id === messageId);

      if (messageToUpdate) {
        dispatch(
          updateMessage({
            channelId,
            message: { ...messageToUpdate, pinned: true, pinnedBy, pinnedAt },
          })
        );
      }
    };

    const handleMessageUnpinned = ({
      messageId,
      channelId,
    }: {
      messageId: string;
      channelId: string;
    }) => {
      const currentMessages = messagesByChannelIdRef.current;
      const messages = currentMessages[channelId]?.messages || [];
      const messageToUpdate = messages.find((msg) => msg.id === messageId);

      if (messageToUpdate) {
        dispatch(
          updateMessage({
            channelId,
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

    socket.on(ServerEvents.NEW_MESSAGE, handleNewMessage);
    socket.on(ServerEvents.UPDATE_MESSAGE, handleUpdateMessage);
    socket.on(ServerEvents.DELETE_MESSAGE, handleDeleteMessage);
    socket.on(ServerEvents.REACTION_ADDED, handleReactionAdded);
    socket.on(ServerEvents.REACTION_REMOVED, handleReactionRemoved);
    socket.on(ServerEvents.MESSAGE_PINNED, handleMessagePinned);
    socket.on(ServerEvents.MESSAGE_UNPINNED, handleMessageUnpinned);

    return () => {
      socket.off(ServerEvents.NEW_MESSAGE, handleNewMessage);
      socket.off(ServerEvents.UPDATE_MESSAGE, handleUpdateMessage);
      socket.off(ServerEvents.DELETE_MESSAGE, handleDeleteMessage);
      socket.off(ServerEvents.REACTION_ADDED, handleReactionAdded);
      socket.off(ServerEvents.REACTION_REMOVED, handleReactionRemoved);
      socket.off(ServerEvents.MESSAGE_PINNED, handleMessagePinned);
      socket.off(ServerEvents.MESSAGE_UNPINNED, handleMessageUnpinned);
    };
  }, [socket, communityId, dispatch]); // Removed messagesByChannelId from deps

  const sendMessage = (msg: Omit<Message, "id">) => {
    // @ts-expect-error: id will be assigned by the server
    socket.emit(ClientEvents.SEND_MESSAGE, msg);
  };

  return { sendMessage };
}
