import { Socket } from "socket.io-client";
import React, { useEffect, useState, useCallback } from "react";
import { getSocketSingleton } from "./socketSingleton";
import {
  SocketContext,
  ServerToClientEvents,
  ClientToServerEvents,
} from "./SocketContext";
import { logger } from "./logger";

const MAX_RETRY_COUNT = 3;
const RETRY_DELAY_MS = 2000;

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connectSocket = useCallback(async (retryCount: number) => {
    try {
      const sock = await getSocketSingleton();
      setSocket(sock);
      setIsConnected(sock.connected);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Socket connection failed");
      logger.error("[Socket] Failed to connect:", error.message);

      if (retryCount < MAX_RETRY_COUNT) {
        logger.info(
          `[Socket] Retrying connection (${retryCount + 1}/${MAX_RETRY_COUNT})...`
        );
        setTimeout(() => {
          connectSocket(retryCount + 1);
        }, RETRY_DELAY_MS);
      } else {
        logger.error("[Socket] Max retries exceeded");
      }
    }
  }, []);

  // Initial connection
  useEffect(() => {
    connectSocket(0);
  }, [connectSocket]);

  // Track connection state via socket events
  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      logger.dev("[Socket] Connected:", socket.id);
      setIsConnected(true);
    };

    const onDisconnect = (reason: string) => {
      logger.warn(`[Socket] Disconnected: ${reason}`);
      setIsConnected(false);

      if (reason === "io server disconnect") {
        // Server initiated disconnect - may need auth refresh
        logger.warn("[Socket] Server-initiated disconnect");
      }
      // For all other reasons, Socket.IO will auto-reconnect
    };

    const onConnectError = (err: Error) => {
      logger.error("[Socket] Connection error:", err.message);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
