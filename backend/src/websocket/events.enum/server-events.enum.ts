// src/websocket/server-events.enum.ts

/**
 * Events emitted by the server and handled by the client.
 */
export enum ServerEvents {
  // Messaging: Channels
  NEW_MESSAGE = 'newMessage',
  UPDATE_MESSAGE = 'updateMessage',
  DELETE_MESSAGE = 'deleteMessage',

  // Messaging: Direct Messages
  NEW_DM = 'newDirectMessage',

  // Mentions & Notifications
  NEW_MENTION = 'newMention',
  NOTIFICATION = 'notification',

  // Presence & Typing
  USER_ONLINE = 'userOnline',
  USER_OFFLINE = 'userOffline',
  USER_TYPING = 'userTyping',

  // Acknowledgments & Errors
  ACK = 'ack',
  ERROR = 'error',
}
