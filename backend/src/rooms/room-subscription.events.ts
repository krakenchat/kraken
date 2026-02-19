/**
 * Domain event types for room subscription management.
 *
 * Services emit these events; the centralized RoomSubscriptionHandler
 * listens and manages WebSocket room joins/leaves accordingly.
 */

// =============================================================================
// Event Name Constants
// =============================================================================

export enum RoomEvents {
  MEMBERSHIP_CREATED = 'membership.created',
  MEMBERSHIP_REMOVED = 'membership.removed',
  MODERATION_USER_BANNED = 'moderation.user-banned',
  MODERATION_USER_KICKED = 'moderation.user-kicked',
  CHANNEL_CREATED = 'channel.created',
  CHANNEL_DELETED = 'channel.deleted',
  CHANNEL_MEMBERSHIP_CREATED = 'channel-membership.created',
  CHANNEL_MEMBERSHIP_REMOVED = 'channel-membership.removed',
  DM_GROUP_CREATED = 'dm-group.created',
  DM_GROUP_MEMBER_ADDED = 'dm-group.member-added',
  DM_GROUP_MEMBER_LEFT = 'dm-group.member-left',
  ALIAS_GROUP_CREATED = 'alias-group.created',
  ALIAS_GROUP_MEMBER_ADDED = 'alias-group.member-added',
  ALIAS_GROUP_MEMBER_REMOVED = 'alias-group.member-removed',
  ALIAS_GROUP_DELETED = 'alias-group.deleted',
  ALIAS_GROUP_MEMBERS_UPDATED = 'alias-group.members-updated',
}

// =============================================================================
// Event Payload Interfaces
// =============================================================================

export interface MembershipCreatedEvent {
  userId: string;
  communityId: string;
}

export interface MembershipRemovedEvent {
  userId: string;
  communityId: string;
}

export interface ModerationUserBannedEvent {
  userId: string;
  communityId: string;
}

export interface ModerationUserKickedEvent {
  userId: string;
  communityId: string;
}

export interface ChannelCreatedEvent {
  channelId: string;
  communityId: string;
  isPrivate: boolean;
}

export interface ChannelDeletedEvent {
  channelId: string;
}

export interface ChannelMembershipCreatedEvent {
  userId: string;
  channelId: string;
}

export interface ChannelMembershipRemovedEvent {
  userId: string;
  channelId: string;
}

export interface DmGroupCreatedEvent {
  groupId: string;
  memberIds: string[];
}

export interface DmGroupMemberAddedEvent {
  groupId: string;
  userIds: string[];
}

export interface DmGroupMemberLeftEvent {
  groupId: string;
  userId: string;
}

export interface AliasGroupCreatedEvent {
  aliasGroupId: string;
  memberIds: string[];
}

export interface AliasGroupMemberAddedEvent {
  aliasGroupId: string;
  userId: string;
}

export interface AliasGroupMemberRemovedEvent {
  aliasGroupId: string;
  userId: string;
}

export interface AliasGroupDeletedEvent {
  aliasGroupId: string;
  memberIds: string[];
}

export interface AliasGroupMembersUpdatedEvent {
  aliasGroupId: string;
  addedUserIds: string[];
  removedUserIds: string[];
}
