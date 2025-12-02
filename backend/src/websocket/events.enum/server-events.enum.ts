// src/websocket/server-events.enum.ts

/**
 * Events emitted by the server and handled by the client.
 */
export enum ServerEvents {
  // Messaging: Channels
  NEW_MESSAGE = 'newMessage',
  UPDATE_MESSAGE = 'updateMessage',
  DELETE_MESSAGE = 'deleteMessage',

  // Message Reactions
  REACTION_ADDED = 'reactionAdded',
  REACTION_REMOVED = 'reactionRemoved',

  // Read Receipts
  READ_RECEIPT_UPDATED = 'readReceiptUpdated',

  // Messaging: Direct Messages
  NEW_DM = 'newDirectMessage',

  // Mentions & Notifications
  NEW_NOTIFICATION = 'newNotification', // New notification created
  NOTIFICATION_READ = 'notificationRead', // Notification marked as read

  // Presence & Typing
  USER_ONLINE = 'userOnline',
  USER_OFFLINE = 'userOffline',
  USER_TYPING = 'userTyping',

  // Voice Channels
  VOICE_CHANNEL_USER_JOINED = 'voiceChannelUserJoined',
  VOICE_CHANNEL_USER_LEFT = 'voiceChannelUserLeft',
  VOICE_CHANNEL_USER_UPDATED = 'voiceChannelUserUpdated',

  // DM Voice Calls
  DM_VOICE_CALL_STARTED = 'dmVoiceCallStarted',
  DM_VOICE_USER_JOINED = 'dmVoiceUserJoined',
  DM_VOICE_USER_LEFT = 'dmVoiceUserLeft',
  DM_VOICE_USER_UPDATED = 'dmVoiceUserUpdated',

  // Replay Buffer (Screen Recording)
  REPLAY_BUFFER_STOPPED = 'replayBufferStopped',
  REPLAY_BUFFER_FAILED = 'replayBufferFailed',

  // Channel Management
  CHANNELS_REORDERED = 'channelsReordered',

  // Acknowledgments & Errors
  ACK = 'ack',
  ERROR = 'error',
}
