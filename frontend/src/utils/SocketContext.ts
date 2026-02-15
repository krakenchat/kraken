import { Socket } from "socket.io-client";
import { createContext } from "react";
import type { ServerToClientEvents, ClientToServerEvents } from "@kraken/shared";

export type { ServerToClientEvents, ClientToServerEvents };

export interface SocketContextValue {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  isConnected: boolean;
}

export const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
});
