/**
 * WebSocket Event Payload Types
 *
 * This file defines TypeScript interfaces for all WebSocket event payloads.
 * IMPORTANT: Keep payload shapes in sync with backend event emissions.
 *
 * @see backend/src/websocket/events.enum/server-events.enum.ts
 * @see backend/src/websocket/events.enum/client-events.enum.ts
 */

import { Message, Reaction } from "./message.type";
import { Channel } from "./channel.type";
import { ServerEvents } from "./server-events.enum";
import {
  NewNotificationPayload,
  NotificationReadPayload,
} from "./notification.type";

// Re-export notification payloads for convenience
export type { NewNotificationPayload, NotificationReadPayload };

// =============================================================================
// Common Types
// =============================================================================

/**
 * Basic user info included in presence and voice events
 */
export interface UserPresenceInfo {
  userId: string;
  username?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

/**
 * User info for voice channel presence
 */
export interface VoicePresenceUser {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  joinedAt: Date | string;
  isDeafened?: boolean;
}

// =============================================================================
// Acknowledgment & Error Payloads
// =============================================================================

export interface AckPayload {
  id: string;
  [key: string]: unknown;
}

export interface ErrorPayload {
  message: string;
  code?: string | number;
  [key: string]: unknown;
}

// =============================================================================
// Message Payloads
// =============================================================================

export interface NewMessagePayload {
  message: Message;
}

export interface UpdateMessagePayload {
  message: Message;
}

export interface DeleteMessagePayload {
  messageId: string;
  channelId?: string | null;
  directMessageGroupId?: string | null;
}

// =============================================================================
// Reaction Payloads
// =============================================================================

export interface ReactionAddedPayload {
  messageId: string;
  reaction: Reaction;
}

export interface ReactionRemovedPayload {
  messageId: string;
  emoji: string;
  reactions: Reaction[];
}

// =============================================================================
// Read Receipt Payloads
// =============================================================================

export interface ReadReceiptUpdatedPayload {
  channelId?: string | null;
  directMessageGroupId?: string | null;
  lastReadMessageId: string;
  lastReadAt: string;
}

// =============================================================================
// Presence & Typing Payloads
// =============================================================================

export type UserOnlinePayload = UserPresenceInfo;

export type UserOfflinePayload = UserPresenceInfo;

export interface UserTypingPayload {
  userId: string;
  channelId?: string;
  directMessageGroupId?: string;
  isTyping: boolean;
}

// =============================================================================
// Voice Channel Payloads
// =============================================================================

export interface VoiceChannelUserJoinedPayload {
  channelId: string;
  user: VoicePresenceUser;
}

export interface VoiceChannelUserLeftPayload {
  channelId: string;
  userId: string;
  user: VoicePresenceUser;
}

export interface VoiceChannelUserUpdatedPayload {
  channelId: string;
  userId: string;
  user: VoicePresenceUser;
}

// =============================================================================
// DM Voice Call Payloads
// =============================================================================

export interface DmVoiceCallStartedPayload {
  dmGroupId: string;
  startedBy: string;
  starter: {
    id: string;
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
}

export interface DmVoiceUserJoinedPayload {
  dmGroupId: string;
  user: VoicePresenceUser;
}

export interface DmVoiceUserLeftPayload {
  dmGroupId: string;
  userId: string;
  user: VoicePresenceUser;
}

export interface DmVoiceUserUpdatedPayload {
  dmGroupId: string;
  userId: string;
  user: VoicePresenceUser;
}

// =============================================================================
// Replay Buffer (Screen Recording) Payloads
// =============================================================================

export interface ReplayBufferStoppedPayload {
  sessionId: string;
  egressId: string;
  channelId: string;
}

export interface ReplayBufferFailedPayload {
  sessionId: string;
  egressId: string;
  channelId: string;
  error: string;
}

// =============================================================================
// Channel Management Payloads
// =============================================================================

export interface ChannelsReorderedPayload {
  communityId: string;
  channels: Channel[];
}

// =============================================================================
// Moderation Payloads
// =============================================================================

export interface UserBannedPayload {
  communityId: string;
  userId: string;
  moderatorId: string;
  reason?: string;
  expiresAt?: string;
}

export interface UserKickedPayload {
  communityId: string;
  userId: string;
  moderatorId: string;
  reason?: string;
}

export interface UserTimedOutPayload {
  communityId: string;
  userId: string;
  moderatorId: string;
  reason?: string;
  durationSeconds: number;
  expiresAt: string;
}

export interface TimeoutRemovedPayload {
  communityId: string;
  userId: string;
  moderatorId: string;
  reason?: string;
}

export interface MessagePinnedPayload {
  messageId: string;
  channelId: string;
  pinnedBy: string;
  pinnedAt: string;
}

export interface MessageUnpinnedPayload {
  messageId: string;
  channelId: string;
  unpinnedBy: string;
}

// =============================================================================
// Server Events Payload Map
// =============================================================================

/**
 * Maps ServerEvents to their corresponding payload types.
 * Use this for type-safe event handling.
 *
 * @example
 * ```typescript
 * function handleEvent<E extends ServerEvents>(
 *   event: E,
 *   payload: ServerEventPayloads[E]
 * ) {
 *   // payload is correctly typed based on event
 * }
 * ```
 */
export type ServerEventPayloads = {
  // Messaging: Channels
  [ServerEvents.NEW_MESSAGE]: NewMessagePayload;
  [ServerEvents.UPDATE_MESSAGE]: UpdateMessagePayload;
  [ServerEvents.DELETE_MESSAGE]: DeleteMessagePayload;

  // Message Reactions
  [ServerEvents.REACTION_ADDED]: ReactionAddedPayload;
  [ServerEvents.REACTION_REMOVED]: ReactionRemovedPayload;

  // Read Receipts
  [ServerEvents.READ_RECEIPT_UPDATED]: ReadReceiptUpdatedPayload;

  // Messaging: Direct Messages
  [ServerEvents.NEW_DM]: NewMessagePayload;

  // Mentions & Notifications
  [ServerEvents.NEW_NOTIFICATION]: NewNotificationPayload;
  [ServerEvents.NOTIFICATION_READ]: NotificationReadPayload;

  // Presence & Typing
  [ServerEvents.USER_ONLINE]: UserOnlinePayload;
  [ServerEvents.USER_OFFLINE]: UserOfflinePayload;
  [ServerEvents.USER_TYPING]: UserTypingPayload;

  // Voice Channels
  [ServerEvents.VOICE_CHANNEL_USER_JOINED]: VoiceChannelUserJoinedPayload;
  [ServerEvents.VOICE_CHANNEL_USER_LEFT]: VoiceChannelUserLeftPayload;
  [ServerEvents.VOICE_CHANNEL_USER_UPDATED]: VoiceChannelUserUpdatedPayload;

  // DM Voice Calls
  [ServerEvents.DM_VOICE_CALL_STARTED]: DmVoiceCallStartedPayload;
  [ServerEvents.DM_VOICE_USER_JOINED]: DmVoiceUserJoinedPayload;
  [ServerEvents.DM_VOICE_USER_LEFT]: DmVoiceUserLeftPayload;
  [ServerEvents.DM_VOICE_USER_UPDATED]: DmVoiceUserUpdatedPayload;

  // Replay Buffer (Screen Recording)
  [ServerEvents.REPLAY_BUFFER_STOPPED]: ReplayBufferStoppedPayload;
  [ServerEvents.REPLAY_BUFFER_FAILED]: ReplayBufferFailedPayload;

  // Channel Management
  [ServerEvents.CHANNELS_REORDERED]: ChannelsReorderedPayload;

  // Moderation Events
  [ServerEvents.USER_BANNED]: UserBannedPayload;
  [ServerEvents.USER_KICKED]: UserKickedPayload;
  [ServerEvents.USER_TIMED_OUT]: UserTimedOutPayload;
  [ServerEvents.TIMEOUT_REMOVED]: TimeoutRemovedPayload;
  [ServerEvents.MESSAGE_PINNED]: MessagePinnedPayload;
  [ServerEvents.MESSAGE_UNPINNED]: MessageUnpinnedPayload;

  // Acknowledgments & Errors
  [ServerEvents.ACK]: AckPayload;
  [ServerEvents.ERROR]: ErrorPayload;
};

// =============================================================================
// Type Helper for Event Handlers
// =============================================================================

/**
 * Type-safe event handler signature
 */
export type ServerEventHandler<E extends ServerEvents> = (
  payload: ServerEventPayloads[E]
) => void;

/**
 * Get payload type for a specific event
 */
export type PayloadOf<E extends ServerEvents> = ServerEventPayloads[E];
