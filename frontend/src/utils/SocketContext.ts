import { Socket } from "socket.io-client";
import { createContext } from "react";
import { ServerEvents } from "../types/server-events.enum";
import { ClientEvents } from "../types/client-events.enum";
import {
  AckPayload,
  ErrorPayload,
  NewMessagePayload,
  UpdateMessagePayload,
  DeleteMessagePayload,
} from "../types/websocket-payloads";

export type ServerToClientEvents = {
  [ServerEvents.NEW_MESSAGE]: (data: NewMessagePayload) => void;
  [ServerEvents.UPDATE_MESSAGE]: (data: UpdateMessagePayload) => void;
  [ServerEvents.DELETE_MESSAGE]: (data: DeleteMessagePayload) => void;
  [ServerEvents.ACK]: (data: AckPayload) => void;
  [ServerEvents.ERROR]: (data: ErrorPayload) => void;
};

export type ClientToServerEvents = {
  [ClientEvents.JOIN_ROOM]: (data: { channelId: string }) => void;
  [ClientEvents.LEAVE_ROOM]: (data: { channelId: string }) => void;
  [ClientEvents.SEND_MESSAGE]: (data: Omit<NewMessagePayload, "id">) => void;
};

export const SocketContext = createContext<Socket<
  ServerToClientEvents,
  ClientToServerEvents
> | null>(null);
