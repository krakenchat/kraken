import { Socket } from "socket.io-client";
import { createContext } from "react";
import type { ServerToClientEvents, ClientToServerEvents } from "@kraken/shared";

export type { ServerToClientEvents, ClientToServerEvents };

export const SocketContext = createContext<Socket<
  ServerToClientEvents,
  ClientToServerEvents
> | null>(null);
