import type { Socket } from "socket.io-client";
import React, { useEffect, useState, useMemo } from "react";
import { getSocketSingleton } from "./socketSingleton";
import {
  SocketContext,
  ServerToClientEvents,
  ClientToServerEvents,
} from "./SocketContext";

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [socket, setSocket] = useState<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let sock: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
    getSocketSingleton()
      .then((s) => {
        sock = s;
        console.log("[SocketProvider] Got socket", sock, "connected:", sock.connected);
        if (isMounted) {
          setSocket(sock);
          setConnected(sock.connected);
          if (sock.connected) setReady(true);
          const handleConnect = () => {
            if (isMounted) {
              setSocket(sock!);
              setConnected(true);
              setReady(true);
              console.log("[SocketProvider] Socket connected", sock!.id);
            }
          };
          const handleDisconnect = (reason?: unknown) => {
            if (isMounted) {
              setConnected(false);
              console.log("[SocketProvider] Socket disconnected", reason);
            }
          };
          const handleConnectError = (err: unknown) => {
            console.error("[SocketProvider] Socket connect_error", err);
          };
          sock.on("connect", handleConnect);
          sock.on("disconnect", handleDisconnect);
          sock.on("connect_error", handleConnectError);
          // Log all events for debugging
          sock.onAny((event, ...args) => {
            console.log(`[SocketProvider] Socket event: ${event}`, ...args);
          });
          // Cleanup listeners on unmount
          return () => {
            sock?.off("connect", handleConnect);
            sock?.off("disconnect", handleDisconnect);
            sock?.off("connect_error", handleConnectError);
            sock?.offAny();
            isMounted = false;
          };
        }
      })
      .catch((err) => {
        console.error("Socket connection failed", err);
      });
    return () => {
      isMounted = false;
      if (sock) {
        sock.off("connect");
        sock.off("disconnect");
        sock.off("connect_error");
        sock.offAny();
      }
    };
  }, []);

  const contextValue = useMemo(
    () => ({ socket, connected }),
    [socket, connected]
  );

  if (!ready) return null;

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
}
