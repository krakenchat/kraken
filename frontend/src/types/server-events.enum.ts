// src/websocket/server-events.enum.ts (frontend copy)
export enum ServerEvents {
  NEW_MESSAGE = "newMessage",
  UPDATE_MESSAGE = "updateMessage",
  DELETE_MESSAGE = "deleteMessage",
  NEW_DM = "newDirectMessage",
  NEW_MENTION = "newMention",
  NOTIFICATION = "notification",
  USER_ONLINE = "userOnline",
  USER_OFFLINE = "userOffline",
  USER_TYPING = "userTyping",
  ACK = "ack",
  ERROR = "error",
}
