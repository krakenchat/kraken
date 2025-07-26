// src/websocket/client-events.enum.ts (frontend copy)
export enum ClientEvents {
  JOIN_ALL = "joinAll",
  JOIN_ROOM = "joinRoom",
  LEAVE_ROOM = "leaveRoom",
  PRESENCE_ONLINE = "presenceOnline",
  SEND_MESSAGE = "sendMessage",
  SEND_DM = "sendDirectMessage",
  TYPING_START = "typingStart",
  TYPING_STOP = "typingStop",
  VOICE_CHANNEL_JOIN = "voice_channel_join",
  VOICE_CHANNEL_LEAVE = "voice_channel_leave",
  VOICE_STATE_UPDATE = "voice_state_update",
  VOICE_PRESENCE_REFRESH = "voice_presence_refresh",
}
