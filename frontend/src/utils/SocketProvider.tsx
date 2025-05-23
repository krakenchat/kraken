import type { Socket } from "socket.io-client";
import React, { useRef, useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  SocketContext,
  ServerToClientEvents,
  ClientToServerEvents,
} from "./SocketContext";
import { getCachedItem, setCachedItem } from "../utils/storage";
import axios from "axios";

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function connectSocket() {
      // Centralized token refresh logic
      let token = getCachedItem<string>("accessToken");
      if (!token) {
        // Try to refresh using the httpOnly cookie
        try {
          const refreshResponse = await axios.post<{ accessToken: string }>(
            "/api/auth/refresh"
          );
          if (refreshResponse.data?.accessToken) {
            setCachedItem("accessToken", refreshResponse.data.accessToken);
            token = refreshResponse.data.accessToken;
          }
        } catch {
          token = null;
        }
      }
      const url = "http://localhost:3000";

      if (!token) {
        console.error("No token available for socket connection");
        return;
      }

      const socket = io(url, {
        transports: ["websocket"],
        auth: { token: `Bearer ${token}` },
      });
      socketRef.current = socket;
      setReady(true);
    }
    connectSocket().then(() => console.log("Socket connected"));
    return () => {
      if (socketRef.current && socketRef.current.connected) {
        console.log("Disconnecting socket");
        socketRef.current.disconnect();
      }
    };
  }, []);

  if (!ready) return null;

  return (
    <SocketContext.Provider value={socketRef.current}>
      {children}
    </SocketContext.Provider>
  );
}
