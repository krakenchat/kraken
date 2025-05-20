// src/websocket/client-events.enum.ts

/**
 * Events emitted by the client and handled by the server.
 */
export enum ClientEvents {
  // Connection & Room Management
  JOIN_ALL = 'joinAll',
  JOIN_ROOM = 'joinRoom',
  LEAVE_ROOM = 'leaveRoom',
  PRESENCE_ONLINE = 'presenceOnline',

  // Messaging: Channels
  SEND_MESSAGE = 'sendMessage',

  // Messaging: Direct Messages
  SEND_DM = 'sendDirectMessage',

  // Presence & Typing
  TYPING_START = 'typingStart',
  TYPING_STOP = 'typingStop',
}
