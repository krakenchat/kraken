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
import { VoicePresenceUser } from "../features/voice-presence/voicePresenceApiSlice";

export type ServerToClientEvents = {
  [ServerEvents.NEW_MESSAGE]: (data: NewMessagePayload) => void;
  [ServerEvents.UPDATE_MESSAGE]: (data: UpdateMessagePayload) => void;
  [ServerEvents.DELETE_MESSAGE]: (data: DeleteMessagePayload) => void;
  [ServerEvents.VOICE_CHANNEL_USER_JOINED]: (data: { channelId: string; user: VoicePresenceUser }) => void;
  [ServerEvents.VOICE_CHANNEL_USER_LEFT]: (data: { channelId: string; userId: string; user: VoicePresenceUser }) => void;
  [ServerEvents.VOICE_CHANNEL_USER_UPDATED]: (data: { channelId: string; userId: string; user: VoicePresenceUser; updates: any }) => void;
  [ServerEvents.ACK]: (data: AckPayload) => void;
  [ServerEvents.ERROR]: (data: ErrorPayload) => void;
};

export type ClientToServerEvents = {
  [ClientEvents.JOIN_ALL]: (communityId: string) => void;
  [ClientEvents.JOIN_ROOM]: (channelId: string) => void;
  [ClientEvents.LEAVE_ROOM]: (channelId: string) => void;
  [ClientEvents.SEND_MESSAGE]: (
    data: Omit<NewMessagePayload, "id">,
    callback?: (messageId: string) => void
  ) => void;
  [ClientEvents.VOICE_CHANNEL_JOIN]: (data: { channelId: string }) => void;
  [ClientEvents.VOICE_CHANNEL_LEAVE]: (data: { channelId: string }) => void;
  [ClientEvents.VOICE_STATE_UPDATE]: (data: { 
    channelId: string; 
    isVideoEnabled?: boolean;
    isScreenSharing?: boolean;
    isMuted?: boolean;
    isDeafened?: boolean;
  }) => void;
  [ClientEvents.VOICE_PRESENCE_REFRESH]: (data: { channelId: string }) => void;
};

export const SocketContext = createContext<Socket<
  ServerToClientEvents,
  ClientToServerEvents
> | null>(null);
