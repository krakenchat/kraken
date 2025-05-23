import { Socket } from "socket.io-client";
import React, { useEffect, useState } from "react";
import { getSocketSingleton } from "./socketSingleton";
import {
  SocketContext,
  ServerToClientEvents,
  ClientToServerEvents,
} from "./SocketContext";

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);

  useEffect(() => {
    let isMounted = true;
    getSocketSingleton()
      .then((s) => {
        if (isMounted) {
          setSocket(s);
        }
      })
      .catch(() => {
        // Optionally handle connection errors
      });
    return () => {
      isMounted = false;
    };
  }, []);

  if (!socket) return null;

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}
