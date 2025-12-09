import { io, Socket } from "socket.io-client";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "./SocketContext";
import { getWebSocketUrl } from "../config/env";
import { logger } from "./logger";
import {
  getAccessToken,
  refreshToken,
  onTokenRefreshed,
} from "./tokenService";

let socketInstance: Socket<ServerToClientEvents, ClientToServerEvents> | null =
  null;
let connectPromise: Promise<
  Socket<ServerToClientEvents, ClientToServerEvents>
> | null = null;

// Subscribe to token refresh events to update socket auth
let unsubscribeTokenRefresh: (() => void) | null = null;

export async function getSocketSingleton(): Promise<
  Socket<ServerToClientEvents, ClientToServerEvents>
> {
  if (socketInstance && socketInstance.connected) {
    return socketInstance;
  }
  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    // Use centralized token service for refresh
    let token = getAccessToken();

    // If no token, try to refresh
    if (!token) {
      logger.dev("[Socket] No access token, attempting refresh...");
      token = await refreshToken();
    }

    if (!token) {
      const error = new Error(
        "No token available for socket connection. Please log in and configure server connection."
      );
      logger.error("[Socket]", error.message);
      throw error;
    }

    // Use configurable WebSocket URL from environment
    const url = getWebSocketUrl();
    logger.dev("[Socket] Connecting to WebSocket URL:", url);

    socketInstance = io(url, {
      transports: ["websocket"],
      auth: { token: `Bearer ${token}` },
    });

    // Subscribe to token refresh events to update socket auth
    // This ensures the socket uses the new token if it reconnects
    if (unsubscribeTokenRefresh) {
      unsubscribeTokenRefresh();
    }
    unsubscribeTokenRefresh = onTokenRefreshed((newToken) => {
      logger.dev("[Socket] Token refreshed, updating socket auth");
      if (socketInstance) {
        socketInstance.auth = { token: `Bearer ${newToken}` };
        // Force reconnect with new token if disconnected
        if (!socketInstance.connected) {
          logger.dev("[Socket] Socket disconnected, reconnecting with new token");
          socketInstance.connect();
        }
      }
    });

    return new Promise<Socket<ServerToClientEvents, ClientToServerEvents>>(
      (resolve, reject) => {
        socketInstance!.on("connect", () => {
          logger.dev("Socket connected " + socketInstance!.id);
          resolve(socketInstance!);
        });
        socketInstance!.on("connect_error", (err) => {
          reject(err);
        });
      }
    );
  })();

  return connectPromise;
}

/**
 * Disconnect the socket and cleanup
 */
export function disconnectSocket(): void {
  if (unsubscribeTokenRefresh) {
    unsubscribeTokenRefresh();
    unsubscribeTokenRefresh = null;
  }
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
  connectPromise = null;
}
