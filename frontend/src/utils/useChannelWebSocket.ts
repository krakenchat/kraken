import { useSocket } from "../utils/useSocket";
import { useEffect } from "react";
import { Message } from "../types/message.type";
import { ServerEvents } from "../types/server-events.enum";
import { ClientEvents } from "../types/client-events.enum";
import { useDispatch } from "react-redux";
import {
  prependMessage,
  updateMessage,
  deleteMessage,
} from "../features/messages/messagesSlice";

export function useChannelWebSocket(channelId: string) {
  const dispatch = useDispatch();
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;
    socket.emit(ClientEvents.JOIN_ROOM, { channelId });
    const handleNewMessage = (data: Message) => {
      dispatch(prependMessage(data));
    };
    const handleUpdateMessage = (data: Message) => {
      dispatch(updateMessage(data));
    };
    const handleDeleteMessage = (data: { id: string }) => {
      dispatch(deleteMessage(data.id));
    };
    socket.on(ServerEvents.NEW_MESSAGE, handleNewMessage);
    socket.on(ServerEvents.UPDATE_MESSAGE, handleUpdateMessage);
    socket.on(ServerEvents.DELETE_MESSAGE, handleDeleteMessage);
    return () => {
      socket.emit(ClientEvents.LEAVE_ROOM, { channelId });
      socket.off(ServerEvents.NEW_MESSAGE, handleNewMessage);
      socket.off(ServerEvents.UPDATE_MESSAGE, handleUpdateMessage);
      socket.off(ServerEvents.DELETE_MESSAGE, handleDeleteMessage);
    };
  }, [socket, channelId, dispatch]);

  const sendMessage = (msg: Omit<Message, "id">) => {
    if (socket) {
      socket.emit(ClientEvents.SEND_MESSAGE, msg);
    }
  };

  return { sendMessage };
}
