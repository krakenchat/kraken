import { useContext } from "react";
import { SocketContext } from "./SocketContext";
import { ClientEvents } from "../types/client-events.enum";
import type { Message } from "../types/message.type";

// Omit id for new message payloads
export type NewMessagePayload = Omit<Message, "id">;

export function useSendMessageSocket(callback?: (messageId: string) => void) {
  const socket = useContext(SocketContext);
  function sendMessage(payload: NewMessagePayload) {
    if (!socket) {
      console.error("Socket not initialized");
      return;
    }
    socket.emit(ClientEvents.SEND_MESSAGE, payload, (messageId: string) =>
      callback ? callback(messageId) : undefined
    );
  }
  return sendMessage;
}
