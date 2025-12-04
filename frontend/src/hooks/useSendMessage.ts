import { useContext, useCallback } from "react";
import { SocketContext } from "../utils/SocketContext";
import { ClientEvents } from "../types/client-events.enum";
import type { Message } from "../types/message.type";

// Omit id for new message payloads
export type NewMessagePayload = Omit<Message, "id">;

export type MessageContext = "channel" | "dm";

/**
 * Error thrown when attempting to send a message without a socket connection
 */
export class SocketNotConnectedError extends Error {
  constructor() {
    super("Socket not connected. Please check your connection and try again.");
    this.name = "SocketNotConnectedError";
  }
}

/**
 * Result of sending a message
 */
export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: Error;
}

/**
 * Unified hook for sending messages in both channels and DMs
 * @param contextType - 'channel' or 'dm'
 * @param callback - Optional callback that receives the messageId after server creates it
 * @returns sendMessage function that returns a Promise with the result
 */
export function useSendMessage(
  contextType: MessageContext,
  callback?: (messageId: string) => void
) {
  const socket = useContext(SocketContext);

  const sendMessage = useCallback(
    (payload: NewMessagePayload): Promise<SendMessageResult> => {
      return new Promise((resolve) => {
        if (!socket) {
          const error = new SocketNotConnectedError();
          console.error("[useSendMessage]", error.message);
          resolve({ success: false, error });
          return;
        }

        if (!socket.connected) {
          const error = new SocketNotConnectedError();
          console.error("[useSendMessage] Socket exists but is disconnected");
          resolve({ success: false, error });
          return;
        }

        // Determine which event to emit based on context
        const event =
          contextType === "channel"
            ? ClientEvents.SEND_MESSAGE
            : ClientEvents.SEND_DM;

        // Emit with acknowledgment callback
        socket.emit(event, payload, (messageId: string) => {
          if (callback) {
            callback(messageId);
          }
          resolve({ success: true, messageId });
        });

        // Add a timeout in case server doesn't respond
        setTimeout(() => {
          resolve({
            success: false,
            error: new Error("Message send timed out. Please try again."),
          });
        }, 10000); // 10 second timeout
      });
    },
    [socket, contextType, callback]
  );

  /**
   * Check if sending is possible (socket is connected)
   */
  const canSend = socket?.connected ?? false;

  return { sendMessage, canSend };
}
