import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { RoomSubscriptionHandler } from './room-subscription.handler';
import { WebsocketService } from '@/websocket/websocket.service';
import { DatabaseService } from '@/database/database.service';
import { createMockDatabase } from '@/test-utils';
import { ServerEvents } from '@kraken/shared';

describe('RoomSubscriptionHandler', () => {
  let handler: RoomSubscriptionHandler;
  let websocketService: Mocked<WebsocketService>;
  let mockDatabase: ReturnType<typeof createMockDatabase>;

  beforeEach(async () => {
    mockDatabase = createMockDatabase();

    const { unit, unitRef } = await TestBed.solitary(RoomSubscriptionHandler)
      .mock(DatabaseService)
      .final(mockDatabase)
      .compile();

    handler = unit;
    websocketService = unitRef.get(WebsocketService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  // =========================================================================
  // Community Membership
  // =========================================================================

  describe('onMembershipCreated', () => {
    it('should join user to community room and all public channel rooms', async () => {
      const userId = 'user-123';
      const communityId = 'community-456';
      const channels = [{ id: 'channel-1' }, { id: 'channel-2' }];

      mockDatabase.channel.findMany.mockResolvedValue(channels);

      await handler.onMembershipCreated({ userId, communityId });

      expect(mockDatabase.channel.findMany).toHaveBeenCalledWith({
        where: { communityId, isPrivate: false },
        select: { id: true },
      });
      expect(websocketService.joinSocketsToRoom).toHaveBeenCalledWith(userId, [
        `community:${communityId}`,
        'channel-1',
        'channel-2',
      ]);
    });

    it('should notify the user about the new community', async () => {
      const userId = 'user-123';
      const communityId = 'community-456';

      mockDatabase.channel.findMany.mockResolvedValue([]);

      await handler.onMembershipCreated({ userId, communityId });

      expect(websocketService.sendToRoom).toHaveBeenCalledWith(
        userId,
        ServerEvents.MEMBER_ADDED_TO_COMMUNITY,
        { communityId, userId },
      );
    });

    it('should join community room even if no public channels exist', async () => {
      const userId = 'user-123';
      const communityId = 'community-456';

      mockDatabase.channel.findMany.mockResolvedValue([]);

      await handler.onMembershipCreated({ userId, communityId });

      expect(websocketService.joinSocketsToRoom).toHaveBeenCalledWith(userId, [
        `community:${communityId}`,
      ]);
    });
  });

  describe('onMembershipRemoved', () => {
    it('should remove user from community room and ALL channel rooms', async () => {
      const userId = 'user-123';
      const communityId = 'community-456';
      const channels = [
        { id: 'channel-1' },
        { id: 'channel-2' },
        { id: 'private-channel-3' },
      ];

      mockDatabase.channel.findMany.mockResolvedValue(channels);

      await handler.onMembershipRemoved({ userId, communityId });

      expect(mockDatabase.channel.findMany).toHaveBeenCalledWith({
        where: { communityId },
        select: { id: true },
      });
      expect(websocketService.removeSocketsFromRoom).toHaveBeenCalledWith(
        userId,
        [
          `community:${communityId}`,
          'channel-1',
          'channel-2',
          'private-channel-3',
        ],
      );
    });
  });

  // =========================================================================
  // Moderation
  // =========================================================================

  describe('onUserBanned', () => {
    it('should remove user from all community rooms (same as membership removal)', async () => {
      const userId = 'user-123';
      const communityId = 'community-456';
      const channels = [{ id: 'channel-1' }];

      mockDatabase.channel.findMany.mockResolvedValue(channels);

      await handler.onUserBanned({ userId, communityId });

      expect(websocketService.removeSocketsFromRoom).toHaveBeenCalledWith(
        userId,
        [`community:${communityId}`, 'channel-1'],
      );
    });
  });

  describe('onUserKicked', () => {
    it('should remove user from all community rooms (same as membership removal)', async () => {
      const userId = 'user-123';
      const communityId = 'community-456';
      const channels = [{ id: 'channel-1' }];

      mockDatabase.channel.findMany.mockResolvedValue(channels);

      await handler.onUserKicked({ userId, communityId });

      expect(websocketService.removeSocketsFromRoom).toHaveBeenCalledWith(
        userId,
        [`community:${communityId}`, 'channel-1'],
      );
    });
  });

  // =========================================================================
  // Channel Lifecycle
  // =========================================================================

  describe('onChannelCreated', () => {
    it('should join all community members to a new public channel', () => {
      const channelId = 'channel-123';
      const communityId = 'community-456';

      handler.onChannelCreated({ channelId, communityId, isPrivate: false });

      expect(websocketService.joinSocketsToRoom).toHaveBeenCalledWith(
        `community:${communityId}`,
        channelId,
      );
    });

    it('should NOT join sockets for a private channel', () => {
      handler.onChannelCreated({
        channelId: 'channel-123',
        communityId: 'community-456',
        isPrivate: true,
      });

      expect(websocketService.joinSocketsToRoom).not.toHaveBeenCalled();
    });
  });

  describe('onChannelDeleted', () => {
    it('should remove all sockets from the deleted channel room', () => {
      const channelId = 'channel-123';

      handler.onChannelDeleted({ channelId });

      expect(websocketService.removeSocketsFromRoom).toHaveBeenCalledWith(
        channelId,
        channelId,
      );
    });
  });

  // =========================================================================
  // Private Channel Membership
  // =========================================================================

  describe('onChannelMembershipCreated', () => {
    it('should join user to private channel room', () => {
      handler.onChannelMembershipCreated({
        userId: 'user-123',
        channelId: 'channel-456',
      });

      expect(websocketService.joinSocketsToRoom).toHaveBeenCalledWith(
        'user-123',
        'channel-456',
      );
    });
  });

  describe('onChannelMembershipRemoved', () => {
    it('should remove user from private channel room', () => {
      handler.onChannelMembershipRemoved({
        userId: 'user-123',
        channelId: 'channel-456',
      });

      expect(websocketService.removeSocketsFromRoom).toHaveBeenCalledWith(
        'user-123',
        'channel-456',
      );
    });
  });

  // =========================================================================
  // Direct Message Groups
  // =========================================================================

  describe('onDmGroupCreated', () => {
    it('should join all members to the DM group room', () => {
      const memberIds = ['user-1', 'user-2', 'user-3'];

      handler.onDmGroupCreated({ groupId: 'dm-group-123', memberIds });

      expect(websocketService.joinSocketsToRoom).toHaveBeenCalledTimes(3);
      expect(websocketService.joinSocketsToRoom).toHaveBeenCalledWith(
        'user-1',
        'dm-group-123',
      );
      expect(websocketService.joinSocketsToRoom).toHaveBeenCalledWith(
        'user-2',
        'dm-group-123',
      );
      expect(websocketService.joinSocketsToRoom).toHaveBeenCalledWith(
        'user-3',
        'dm-group-123',
      );
    });
  });

  describe('onDmGroupMemberAdded', () => {
    it('should join new members to the DM group room', () => {
      handler.onDmGroupMemberAdded({
        groupId: 'dm-group-123',
        userIds: ['user-4', 'user-5'],
      });

      expect(websocketService.joinSocketsToRoom).toHaveBeenCalledTimes(2);
      expect(websocketService.joinSocketsToRoom).toHaveBeenCalledWith(
        'user-4',
        'dm-group-123',
      );
      expect(websocketService.joinSocketsToRoom).toHaveBeenCalledWith(
        'user-5',
        'dm-group-123',
      );
    });
  });

  describe('onDmGroupMemberLeft', () => {
    it('should remove user from the DM group room', () => {
      handler.onDmGroupMemberLeft({
        groupId: 'dm-group-123',
        userId: 'user-123',
      });

      expect(websocketService.removeSocketsFromRoom).toHaveBeenCalledWith(
        'user-123',
        'dm-group-123',
      );
    });
  });

  // =========================================================================
  // Alias Groups
  // =========================================================================

  describe('onAliasGroupCreated', () => {
    it('should join all members to the alias group room', () => {
      const memberIds = ['user-1', 'user-2'];

      handler.onAliasGroupCreated({ aliasGroupId: 'alias-123', memberIds });

      expect(websocketService.joinSocketsToRoom).toHaveBeenCalledTimes(2);
      expect(websocketService.joinSocketsToRoom).toHaveBeenCalledWith(
        'user-1',
        'alias:alias-123',
      );
      expect(websocketService.joinSocketsToRoom).toHaveBeenCalledWith(
        'user-2',
        'alias:alias-123',
      );
    });
  });

  describe('onAliasGroupMemberAdded', () => {
    it('should join user to alias group room', () => {
      handler.onAliasGroupMemberAdded({
        aliasGroupId: 'alias-123',
        userId: 'user-456',
      });

      expect(websocketService.joinSocketsToRoom).toHaveBeenCalledWith(
        'user-456',
        'alias:alias-123',
      );
    });
  });

  describe('onAliasGroupMemberRemoved', () => {
    it('should remove user from alias group room', () => {
      handler.onAliasGroupMemberRemoved({
        aliasGroupId: 'alias-123',
        userId: 'user-456',
      });

      expect(websocketService.removeSocketsFromRoom).toHaveBeenCalledWith(
        'user-456',
        'alias:alias-123',
      );
    });
  });

  describe('onAliasGroupDeleted', () => {
    it('should remove all members from the alias group room', () => {
      const memberIds = ['user-1', 'user-2'];

      handler.onAliasGroupDeleted({ aliasGroupId: 'alias-123', memberIds });

      expect(websocketService.removeSocketsFromRoom).toHaveBeenCalledTimes(2);
      expect(websocketService.removeSocketsFromRoom).toHaveBeenCalledWith(
        'user-1',
        'alias:alias-123',
      );
      expect(websocketService.removeSocketsFromRoom).toHaveBeenCalledWith(
        'user-2',
        'alias:alias-123',
      );
    });
  });

  describe('onAliasGroupMembersUpdated', () => {
    it('should join added members and remove removed members', () => {
      handler.onAliasGroupMembersUpdated({
        aliasGroupId: 'alias-123',
        addedUserIds: ['user-new'],
        removedUserIds: ['user-old'],
      });

      expect(websocketService.joinSocketsToRoom).toHaveBeenCalledWith(
        'user-new',
        'alias:alias-123',
      );
      expect(websocketService.removeSocketsFromRoom).toHaveBeenCalledWith(
        'user-old',
        'alias:alias-123',
      );
    });

    it('should handle empty added/removed arrays', () => {
      handler.onAliasGroupMembersUpdated({
        aliasGroupId: 'alias-123',
        addedUserIds: [],
        removedUserIds: [],
      });

      expect(websocketService.joinSocketsToRoom).not.toHaveBeenCalled();
      expect(websocketService.removeSocketsFromRoom).not.toHaveBeenCalled();
    });
  });
});
