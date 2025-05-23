import { useSocket } from "./useSocket";
import { useEffect } from "react";
import { Message } from "../types/message.type";
import { ServerEvents } from "../types/server-events.enum";
import { ClientEvents } from "../types/client-events.enum";
import { useAppDispatch } from "../app/hooks";
import {
  prependMessage,
  updateMessage,
  deleteMessage,
} from "../features/messages/messagesSlice";

export function useChannelWebSocket(communityId: string | undefined) {
  const dispatch = useAppDispatch();
  const socket = useSocket();

  useEffect(() => {
    if (!socket || !communityId) return;
    // No need to join/leave community here; handled by useCommunityJoin

    const handleNewMessage = ({ message }: { message: Message }) => {
      if (message.channelId) {
        dispatch(prependMessage({ channelId: message.channelId, message }));
      }
    };
    const handleUpdateMessage = ({ message }: { message: Message }) => {
      if (message.channelId) {
        dispatch(updateMessage({ channelId: message.channelId, message }));
      }
    };
    const handleDeleteMessage = ({
      id,
      channelId,
    }: {
      id: string;
      channelId: string;
    }) => {
      if (channelId) {
        dispatch(deleteMessage({ channelId, id }));
      }
    };
    socket.on(ServerEvents.NEW_MESSAGE, handleNewMessage);
    socket.on(ServerEvents.UPDATE_MESSAGE, handleUpdateMessage);
    socket.on(ServerEvents.DELETE_MESSAGE, handleDeleteMessage);
    return () => {
      socket.off(ServerEvents.NEW_MESSAGE, handleNewMessage);
      socket.off(ServerEvents.UPDATE_MESSAGE, handleUpdateMessage);
      socket.off(ServerEvents.DELETE_MESSAGE, handleDeleteMessage);
    };
  }, [socket, communityId, dispatch]);

  const sendMessage = (msg: Omit<Message, "id">) => {
    // @ts-expect-error: id will be assigned by the server
    socket.emit(ClientEvents.SEND_MESSAGE, msg);
  };

  return { sendMessage };
}
