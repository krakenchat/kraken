import { useContext, useCallback } from "react";
import { Socket } from "socket.io-client";
import { logger } from "../utils/logger";
import { SocketContext } from "../utils/SocketContext";
import { ClientEvents } from '@kraken/shared';
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
 * Wait for socket reconnection with a timeout.
 * Returns true if connected within the timeout, false otherwise.
 */
function waitForReconnection(socket: Socket, timeoutMs: number): Promise<boolean> {
  if (socket.connected) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      socket.off('connect', onConnect);
      resolve(false);
    }, timeoutMs);
    const onConnect = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    socket.once('connect', onConnect);
  });
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
  const { socket, isConnected } = useContext(SocketContext);

  const sendMessage = useCallback(
    (payload: NewMessagePayload): Promise<SendMessageResult> => {
      return new Promise((resolve) => {
        if (!socket) {
          const error = new SocketNotConnectedError();
          logger.error("[useSendMessage]", error.message);
          resolve({ success: false, error });
          return;
        }

        const doSend = () => {
          // Determine which event to emit based on context
          const event =
            contextType === "channel"
              ? ClientEvents.SEND_MESSAGE
              : ClientEvents.SEND_DM;

          // Add a timeout in case server doesn't respond
          const timeoutId = setTimeout(() => {
            resolve({
              success: false,
              error: new Error("Message send timed out. Please try again."),
            });
          }, 10000); // 10 second timeout

          // Emit with acknowledgment callback
          socket.emit(event, payload, (messageId: string) => {
            clearTimeout(timeoutId); // Clear timeout on success
            if (callback) {
              callback(messageId);
            }
            resolve({ success: true, messageId });
          });
        };

        if (!socket.connected) {
          // Wait for reconnection before failing
          logger.warn("[useSendMessage] Socket disconnected, waiting for reconnection...");
          waitForReconnection(socket, 5000).then((connected) => {
            if (!connected) {
              const error = new SocketNotConnectedError();
              logger.error("[useSendMessage] Reconnection timed out");
              resolve({ success: false, error });
              return;
            }
            doSend();
          });
          return;
        }

        doSend();
      });
    },
    [socket, contextType, callback]
  );

  /**
   * Check if sending is possible (socket is connected)
   */
  const canSend = isConnected;

  return { sendMessage, canSend };
}
