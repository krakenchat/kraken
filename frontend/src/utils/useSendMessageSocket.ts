import { useContext } from "react";
import { SocketContext } from "./SocketContext";
import { ClientEvents } from "../types/client-events.enum";
import type { Message } from "../types/message.type";

// Omit id for new message payloads
export type NewMessagePayload = Omit<Message, "id">;

export function useSendMessageSocket() {
  const ctx = useContext(SocketContext);
  console.log("[useSendMessageSocket] Context:", ctx);
  // Always use the latest context/socket when sendMessage is called
  function sendMessage(payload: NewMessagePayload) {
    if (!ctx || !ctx.socket) {
      console.error("Socket not initialized");
      return;
    }
    if (!ctx.connected) {
      console.warn("Socket not connected, cannot emit SEND_MESSAGE");
      return;
    }
    console.log("[useSendMessageSocket] About to emit:", {
      event: ClientEvents.SEND_MESSAGE,
      payload,
      socketConnected: ctx.connected,
      socketId: ctx.socket.id,
    });
    ctx.socket.emit(ClientEvents.SEND_MESSAGE, payload);
  }
  return sendMessage;
}
