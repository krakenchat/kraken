import { Socket } from "socket.io-client";
import React, { useEffect, useState, useCallback } from "react";
import { getSocketSingleton } from "./socketSingleton";
import {
  SocketContext,
  ServerToClientEvents,
  ClientToServerEvents,
} from "./SocketContext";
import { logger } from "./logger";

interface SocketConnectionState {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  error: Error | null;
  isConnecting: boolean;
  retryCount: number;
}

const MAX_RETRY_COUNT = 3;
const RETRY_DELAY_MS = 2000;

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SocketConnectionState>({
    socket: null,
    error: null,
    isConnecting: true,
    retryCount: 0,
  });

  const connectSocket = useCallback(async (retryCount: number) => {
    setState((prev) => ({
      ...prev,
      isConnecting: true,
      error: null,
      retryCount,
    }));

    try {
      const socket = await getSocketSingleton();
      setState({
        socket,
        error: null,
        isConnecting: false,
        retryCount: 0,
      });

      // Set up disconnect/reconnect handlers
      socket.on("disconnect", (reason) => {
        logger.warn(`[Socket] Disconnected: ${reason}`);
        if (reason === "io server disconnect") {
          // Server initiated disconnect - may need auth refresh
          setState((prev) => ({
            ...prev,
            socket: null,
            error: new Error("Disconnected by server"),
          }));
        }
      });

      socket.on("connect_error", (err) => {
        logger.error("[Socket] Connection error:", err.message);
        setState((prev) => ({
          ...prev,
          error: err,
        }));
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Socket connection failed");
      logger.error("[Socket] Failed to connect:", error.message);

      // Retry if under limit
      if (retryCount < MAX_RETRY_COUNT) {
        logger.info(`[Socket] Retrying connection (${retryCount + 1}/${MAX_RETRY_COUNT})...`);
        setTimeout(() => {
          connectSocket(retryCount + 1);
        }, RETRY_DELAY_MS);
      } else {
        logger.error("[Socket] Max retries exceeded");
        setState({
          socket: null,
          error,
          isConnecting: false,
          retryCount,
        });
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Only connect if still mounted
    if (isMounted) {
      connectSocket(0);
    }

    return () => {
      isMounted = false;
    };
  }, [connectSocket]);

  // Always render children - socket may not be available immediately
  // Components should handle null socket gracefully
  return (
    <SocketContext.Provider value={state.socket}>
      {children}
    </SocketContext.Provider>
  );
}
