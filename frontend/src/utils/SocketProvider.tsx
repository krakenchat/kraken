import { Socket } from "socket.io-client";
import React, { useEffect, useRef, useState } from "react";
import { getSocketSingleton } from "./socketSingleton";
import {
  SocketContext,
  ServerToClientEvents,
  ClientToServerEvents,
} from "./SocketContext";
import { logger } from "./logger";
import { refreshToken, notifyAuthFailure } from "./tokenService";

const MAX_SERVER_DISCONNECT_RETRIES = 3;
const MAX_BACKOFF_MS = 10_000;

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket] = useState<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(() => {
    try {
      return getSocketSingleton();
    } catch (err) {
      logger.error(
        "[Socket] Failed to create socket:",
        err instanceof Error ? err.message : err
      );
      return null;
    }
  });
  const [isConnected, setIsConnected] = useState(socket?.connected ?? false);
  const serverDisconnectCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHandlingAuthFailure = useRef(false);

  // Track connection state via socket events
  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      logger.dev("[Socket] Connected:", socket.id);
      serverDisconnectCount.current = 0;
      setIsConnected(true);
    };

    const onDisconnect = (reason: string) => {
      logger.warn(`[Socket] Disconnected: ${reason}`);
      setIsConnected(false);

      if (reason === "io server disconnect") {
        // Clear any pending reconnect timer from a previous disconnect
        if (reconnectTimer.current) {
          clearTimeout(reconnectTimer.current);
          reconnectTimer.current = null;
        }

        serverDisconnectCount.current++;

        if (serverDisconnectCount.current >= MAX_SERVER_DISCONNECT_RETRIES) {
          // Circuit breaker — persistent auth problem
          logger.error(
            "[Socket] Too many server-initiated disconnects, logging out"
          );
          notifyAuthFailure();
          return;
        }

        // Exponential backoff: 1s, 2s, 4s... capped at 10s
        const delay = Math.min(
          1000 * Math.pow(2, serverDisconnectCount.current - 1),
          MAX_BACKOFF_MS
        );
        logger.warn(
          `[Socket] Server-initiated disconnect, reconnecting in ${delay}ms (attempt ${serverDisconnectCount.current})`
        );
        reconnectTimer.current = setTimeout(() => {
          socket.connect();
        }, delay);
      }
      // For all other reasons, Socket.IO will auto-reconnect
    };

    const onConnectError = (err: Error) => {
      logger.error("[Socket] Connection error:", err.message);

      if (err.message === "AUTH_FAILED" && !isHandlingAuthFailure.current) {
        isHandlingAuthFailure.current = true;
        // Disable auto-reconnection while we attempt token refresh
        socket.io.opts.reconnection = false;

        refreshToken()
          .then((newToken) => {
            socket.io.opts.reconnection = true;
            isHandlingAuthFailure.current = false;
            if (newToken) {
              logger.dev("[Socket] Token refreshed, reconnecting...");
              socket.connect();
            } else {
              logger.error(
                "[Socket] Token refresh returned null, logging out"
              );
              notifyAuthFailure();
            }
          })
          .catch(() => {
            socket.io.opts.reconnection = true;
            isHandlingAuthFailure.current = false;
            logger.error("[Socket] Token refresh failed, logging out");
            notifyAuthFailure();
          });
      }
      // For non-auth errors, Socket.IO's built-in reconnection handles it
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    // If the socket connected before this effect ran (or during a
    // StrictMode cleanup/re-register cycle), sync state now.
    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
