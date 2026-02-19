import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WebsocketService } from '@/websocket/websocket.service';
import { DatabaseService } from '@/database/database.service';
import { ServerEvents } from '@kraken/shared';
import {
  RoomEvents,
  MembershipCreatedEvent,
  MembershipRemovedEvent,
  ModerationUserBannedEvent,
  ModerationUserKickedEvent,
  ChannelCreatedEvent,
  ChannelDeletedEvent,
  ChannelMembershipCreatedEvent,
  ChannelMembershipRemovedEvent,
  DmGroupCreatedEvent,
  DmGroupMemberAddedEvent,
  DmGroupMemberLeftEvent,
  AliasGroupCreatedEvent,
  AliasGroupMemberAddedEvent,
  AliasGroupMemberRemovedEvent,
  AliasGroupDeletedEvent,
  AliasGroupMembersUpdatedEvent,
} from './room-subscription.events';

/**
 * Centralized handler for all WebSocket room subscription changes.
 *
 * Services emit domain events (e.g. 'membership.created'); this handler
 * translates them into Socket.IO room joins/leaves so clients receive
 * the correct real-time events without any client-side subscription logic.
 */
@Injectable()
export class RoomSubscriptionHandler {
  private readonly logger = new Logger(RoomSubscriptionHandler.name);

  constructor(
    private readonly websocketService: WebsocketService,
    private readonly databaseService: DatabaseService,
  ) {}

  // =========================================================================
  // Community Membership
  // =========================================================================

  @OnEvent(RoomEvents.MEMBERSHIP_CREATED)
  async onMembershipCreated({
    userId,
    communityId,
  }: MembershipCreatedEvent): Promise<void> {
    const publicChannels = await this.databaseService.channel.findMany({
      where: { communityId, isPrivate: false },
      select: { id: true },
    });

    const roomsToJoin = [
      `community:${communityId}`,
      ...publicChannels.map((ch) => ch.id),
    ];

    this.websocketService.joinSocketsToRoom(userId, roomsToJoin);

    // Notify the user's UI to refresh the community list
    this.websocketService.sendToRoom(
      userId,
      ServerEvents.MEMBER_ADDED_TO_COMMUNITY,
      { communityId, userId },
    );

    this.logger.debug(
      `User ${userId} joined rooms for community ${communityId} (${roomsToJoin.length} rooms)`,
    );
  }

  @OnEvent(RoomEvents.MEMBERSHIP_REMOVED)
  async onMembershipRemoved({
    userId,
    communityId,
  }: MembershipRemovedEvent): Promise<void> {
    const channels = await this.databaseService.channel.findMany({
      where: { communityId },
      select: { id: true },
    });

    const roomsToLeave = [
      `community:${communityId}`,
      ...channels.map((ch) => ch.id),
    ];

    this.websocketService.removeSocketsFromRoom(userId, roomsToLeave);

    this.logger.debug(
      `User ${userId} left rooms for community ${communityId} (${roomsToLeave.length} rooms)`,
    );
  }

  // =========================================================================
  // Moderation (Ban / Kick)
  // =========================================================================

  @OnEvent(RoomEvents.MODERATION_USER_BANNED)
  async onUserBanned({
    userId,
    communityId,
  }: ModerationUserBannedEvent): Promise<void> {
    // Same room cleanup as membership removal
    await this.onMembershipRemoved({ userId, communityId });
  }

  @OnEvent(RoomEvents.MODERATION_USER_KICKED)
  async onUserKicked({
    userId,
    communityId,
  }: ModerationUserKickedEvent): Promise<void> {
    // Same room cleanup as membership removal
    await this.onMembershipRemoved({ userId, communityId });
  }

  // =========================================================================
  // Channel Lifecycle
  // =========================================================================

  @OnEvent(RoomEvents.CHANNEL_CREATED)
  onChannelCreated({
    channelId,
    communityId,
    isPrivate,
  }: ChannelCreatedEvent): void {
    if (!isPrivate) {
      // All community members should join the new public channel room
      this.websocketService.joinSocketsToRoom(
        `community:${communityId}`,
        channelId,
      );
      this.logger.debug(
        `All members of community ${communityId} joined public channel ${channelId}`,
      );
    }
  }

  @OnEvent(RoomEvents.CHANNEL_DELETED)
  onChannelDeleted({ channelId }: ChannelDeletedEvent): void {
    // Remove all sockets from the deleted channel's room
    this.websocketService.removeSocketsFromRoom(channelId, channelId);
    this.logger.debug(`All sockets removed from deleted channel ${channelId}`);
  }

  // =========================================================================
  // Private Channel Membership
  // =========================================================================

  @OnEvent(RoomEvents.CHANNEL_MEMBERSHIP_CREATED)
  onChannelMembershipCreated({
    userId,
    channelId,
  }: ChannelMembershipCreatedEvent): void {
    this.websocketService.joinSocketsToRoom(userId, channelId);
    this.logger.debug(
      `User ${userId} joined private channel room ${channelId}`,
    );
  }

  @OnEvent(RoomEvents.CHANNEL_MEMBERSHIP_REMOVED)
  onChannelMembershipRemoved({
    userId,
    channelId,
  }: ChannelMembershipRemovedEvent): void {
    this.websocketService.removeSocketsFromRoom(userId, channelId);
    this.logger.debug(`User ${userId} left private channel room ${channelId}`);
  }

  // =========================================================================
  // Direct Message Groups
  // =========================================================================

  @OnEvent(RoomEvents.DM_GROUP_CREATED)
  onDmGroupCreated({ groupId, memberIds }: DmGroupCreatedEvent): void {
    for (const userId of memberIds) {
      this.websocketService.joinSocketsToRoom(userId, groupId);
    }
    this.logger.debug(
      `${memberIds.length} members joined DM group room ${groupId}`,
    );
  }

  @OnEvent(RoomEvents.DM_GROUP_MEMBER_ADDED)
  onDmGroupMemberAdded({ groupId, userIds }: DmGroupMemberAddedEvent): void {
    for (const userId of userIds) {
      this.websocketService.joinSocketsToRoom(userId, groupId);
    }
    this.logger.debug(
      `${userIds.length} members added to DM group room ${groupId}`,
    );
  }

  @OnEvent(RoomEvents.DM_GROUP_MEMBER_LEFT)
  onDmGroupMemberLeft({ groupId, userId }: DmGroupMemberLeftEvent): void {
    this.websocketService.removeSocketsFromRoom(userId, groupId);
    this.logger.debug(`User ${userId} left DM group room ${groupId}`);
  }

  // =========================================================================
  // Alias Groups
  // =========================================================================

  @OnEvent(RoomEvents.ALIAS_GROUP_CREATED)
  onAliasGroupCreated({
    aliasGroupId,
    memberIds,
  }: AliasGroupCreatedEvent): void {
    for (const userId of memberIds) {
      this.websocketService.joinSocketsToRoom(userId, `alias:${aliasGroupId}`);
    }
    this.logger.debug(
      `${memberIds.length} members joined alias group room ${aliasGroupId}`,
    );
  }

  @OnEvent(RoomEvents.ALIAS_GROUP_MEMBER_ADDED)
  onAliasGroupMemberAdded({
    aliasGroupId,
    userId,
  }: AliasGroupMemberAddedEvent): void {
    this.websocketService.joinSocketsToRoom(userId, `alias:${aliasGroupId}`);
    this.logger.debug(`User ${userId} joined alias group room ${aliasGroupId}`);
  }

  @OnEvent(RoomEvents.ALIAS_GROUP_MEMBER_REMOVED)
  onAliasGroupMemberRemoved({
    aliasGroupId,
    userId,
  }: AliasGroupMemberRemovedEvent): void {
    this.websocketService.removeSocketsFromRoom(
      userId,
      `alias:${aliasGroupId}`,
    );
    this.logger.debug(`User ${userId} left alias group room ${aliasGroupId}`);
  }

  @OnEvent(RoomEvents.ALIAS_GROUP_DELETED)
  onAliasGroupDeleted({
    aliasGroupId,
    memberIds,
  }: AliasGroupDeletedEvent): void {
    for (const userId of memberIds) {
      this.websocketService.removeSocketsFromRoom(
        userId,
        `alias:${aliasGroupId}`,
      );
    }
    this.logger.debug(
      `${memberIds.length} members removed from deleted alias group room ${aliasGroupId}`,
    );
  }

  @OnEvent(RoomEvents.ALIAS_GROUP_MEMBERS_UPDATED)
  onAliasGroupMembersUpdated({
    aliasGroupId,
    addedUserIds,
    removedUserIds,
  }: AliasGroupMembersUpdatedEvent): void {
    for (const userId of addedUserIds) {
      this.websocketService.joinSocketsToRoom(userId, `alias:${aliasGroupId}`);
    }
    for (const userId of removedUserIds) {
      this.websocketService.removeSocketsFromRoom(
        userId,
        `alias:${aliasGroupId}`,
      );
    }
    this.logger.debug(
      `Alias group ${aliasGroupId} updated: +${addedUserIds.length} -${removedUserIds.length} members`,
    );
  }
}
