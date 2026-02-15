import { useContext, useCallback } from "react";
import { logger } from "../utils/logger";
import { SocketContext } from "../utils/SocketContext";
import { ClientEvents } from '@kraken/shared';
import type { Message } from "../types/message.type";
import {
  SocketNotConnectedError,
  SendMessageResult,
} from "./useSendMessage";

// Omit id for new message payloads
export type NewMessagePayload = Omit<Message, "id">;

/**
 * @deprecated Use useSendMessage("channel", callback) instead.
 * This hook is kept for backwards compatibility.
 */
export function useSendMessageSocket(callback?: (messageId: string) => void) {
  const { socket } = useContext(SocketContext);

  const sendMessage = useCallback(
    (payload: NewMessagePayload): Promise<SendMessageResult> => {
      return new Promise((resolve) => {
        if (!socket) {
          const error = new SocketNotConnectedError();
          logger.error("[useSendMessageSocket]", error.message);
          resolve({ success: false, error });
          return;
        }

        if (!socket.connected) {
          const error = new SocketNotConnectedError();
          logger.error("[useSendMessageSocket] Socket exists but is disconnected");
          resolve({ success: false, error });
          return;
        }

        socket.emit(ClientEvents.SEND_MESSAGE, payload, (messageId: string) => {
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
        }, 10000);
      });
    },
    [socket, callback]
  );

  const canSend = socket?.connected ?? false;

  return { sendMessage, canSend };
}
