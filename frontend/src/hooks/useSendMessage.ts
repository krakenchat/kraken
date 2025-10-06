import { useContext } from "react";
import { SocketContext } from "../utils/SocketContext";
import { ClientEvents } from "../types/client-events.enum";
import type { Message } from "../types/message.type";

// Omit id for new message payloads
export type NewMessagePayload = Omit<Message, "id">;

export type MessageContext = "channel" | "dm";

/**
 * Unified hook for sending messages in both channels and DMs
 * @param contextType - 'channel' or 'dm'
 * @param callback - Optional callback that receives the messageId after server creates it
 * @returns sendMessage function
 */
export function useSendMessage(
  contextType: MessageContext,
  callback?: (messageId: string) => void
) {
  const socket = useContext(SocketContext);

  function sendMessage(payload: NewMessagePayload) {
    if (!socket) {
      console.error("Socket not initialized");
      return;
    }

    // Determine which event to emit based on context
    const event = contextType === "channel"
      ? ClientEvents.SEND_MESSAGE
      : ClientEvents.SEND_DM;

    // Emit with acknowledgment callback
    socket.emit(event, payload, (messageId: string) => {
      if (callback) {
        callback(messageId);
      }
    });
  }

  return sendMessage;
}
