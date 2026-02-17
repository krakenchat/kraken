import { TestBed } from '@suites/unit';
import { RoomsService } from './rooms.service';
import { DatabaseService } from '@/database/database.service';
import { createMockDatabase } from '@/test-utils';
import { Socket } from 'socket.io';

describe('RoomsService', () => {
  let service: RoomsService;
  let mockDatabase: ReturnType<typeof createMockDatabase>;

  const createMockClient = (userId: string): Socket => {
    return {
      id: 'socket-123',
      handshake: {
        user: { id: userId },
      },
      join: jest.fn().mockResolvedValue(undefined),
      rooms: new Set(['room-1', 'room-2']),
    } as unknown as Socket;
  };

  beforeEach(async () => {
    mockDatabase = createMockDatabase();

    const { unit } = await TestBed.solitary(RoomsService)
      .mock(DatabaseService)
      .final(mockDatabase)
      .compile();

    service = unit;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('joinAll', () => {
    it('should join user to their own room', async () => {
      const userId = 'user-123';
      const communityId = 'community-456';
      const client = createMockClient(userId);

      mockDatabase.channel.findMany.mockResolvedValue([]);
      mockDatabase.channelMembership.findMany.mockResolvedValue([]);
      mockDatabase.directMessageGroupMember.findMany.mockResolvedValue([]);
      mockDatabase.aliasGroupMember.findMany.mockResolvedValue([]);

      await service.joinAll(client as any, communityId);

      expect(client.join).toHaveBeenCalledWith(userId);
    });

    it('should join all public channels in the community', async () => {
      const userId = 'user-123';
      const communityId = 'community-456';
      const client = createMockClient(userId);

      const publicChannels = [
        { id: 'channel-1', communityId, isPrivate: false },
        { id: 'channel-2', communityId, isPrivate: false },
        { id: 'channel-3', communityId, isPrivate: false },
      ];

      mockDatabase.channel.findMany.mockResolvedValue(publicChannels);
      mockDatabase.channelMembership.findMany.mockResolvedValue([]);
      mockDatabase.directMessageGroupMember.findMany.mockResolvedValue([]);
      mockDatabase.aliasGroupMember.findMany.mockResolvedValue([]);

      await service.joinAll(client as any, communityId);

      expect(mockDatabase.channel.findMany).toHaveBeenCalledWith({
        where: {
          communityId,
          isPrivate: false,
        },
      });
      expect(client.join).toHaveBeenCalledWith('channel-1');
      expect(client.join).toHaveBeenCalledWith('channel-2');
      expect(client.join).toHaveBeenCalledWith('channel-3');
    });

    it('should join private channels based on membership', async () => {
      const userId = 'user-123';
      const communityId = 'community-456';
      const client = createMockClient(userId);

      const privateChannelMemberships = [
        {
          userId,
          channelId: 'private-channel-1',
          channel: { id: 'private-channel-1', isPrivate: true, communityId },
        },
        {
          userId,
          channelId: 'private-channel-2',
          channel: { id: 'private-channel-2', isPrivate: true, communityId },
        },
      ];

      mockDatabase.channel.findMany.mockResolvedValue([]);
      mockDatabase.channelMembership.findMany.mockResolvedValue(
        privateChannelMemberships,
      );
      mockDatabase.directMessageGroupMember.findMany.mockResolvedValue([]);
      mockDatabase.aliasGroupMember.findMany.mockResolvedValue([]);

      await service.joinAll(client as any, communityId);

      expect(mockDatabase.channelMembership.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          channel: {
            communityId,
            isPrivate: true,
          },
        },
        include: {
          channel: true,
        },
      });
      expect(client.join).toHaveBeenCalledWith('private-channel-1');
      expect(client.join).toHaveBeenCalledWith('private-channel-2');
    });

    it('should join all direct messages for the user', async () => {
      const userId = 'user-123';
      const communityId = 'community-456';
      const client = createMockClient(userId);

      const directMessages = [
        { userId, groupId: 'dm-group-1' },
        { userId, groupId: 'dm-group-2' },
        { userId, groupId: 'dm-group-3' },
      ];

      mockDatabase.channel.findMany.mockResolvedValue([]);
      mockDatabase.channelMembership.findMany.mockResolvedValue([]);
      mockDatabase.directMessageGroupMember.findMany.mockResolvedValue(
        directMessages,
      );
      mockDatabase.aliasGroupMember.findMany.mockResolvedValue([]);

      await service.joinAll(client as any, communityId);

      expect(
        mockDatabase.directMessageGroupMember.findMany,
      ).toHaveBeenCalledWith({
        where: {
          userId,
        },
      });
      expect(client.join).toHaveBeenCalledWith('dm-group-1');
      expect(client.join).toHaveBeenCalledWith('dm-group-2');
      expect(client.join).toHaveBeenCalledWith('dm-group-3');
    });

    it('should join all alias groups for the user', async () => {
      const userId = 'user-123';
      const communityId = 'community-456';
      const client = createMockClient(userId);

      const aliasGroups = [
        { userId, aliasGroupId: 'alias-group-1' },
        { userId, aliasGroupId: 'alias-group-2' },
      ];

      mockDatabase.channel.findMany.mockResolvedValue([]);
      mockDatabase.channelMembership.findMany.mockResolvedValue([]);
      mockDatabase.directMessageGroupMember.findMany.mockResolvedValue([]);
      mockDatabase.aliasGroupMember.findMany.mockResolvedValue(aliasGroups);

      await service.joinAll(client as any, communityId);

      expect(mockDatabase.aliasGroupMember.findMany).toHaveBeenCalledWith({
        where: {
          userId,
        },
      });
      expect(client.join).toHaveBeenCalledWith('alias-group-1');
      expect(client.join).toHaveBeenCalledWith('alias-group-2');
    });

    it('should join all room types in a single call', async () => {
      const userId = 'user-789';
      const communityId = 'community-999';
      const client = createMockClient(userId);

      const publicChannels = [{ id: 'public-1', isPrivate: false }];
      const privateMemberships = [
        { channelId: 'private-1', channel: { id: 'private-1' } },
      ];
      const directMessages = [{ groupId: 'dm-1' }];
      const aliasGroups = [{ aliasGroupId: 'alias-1' }];

      mockDatabase.channel.findMany.mockResolvedValue(publicChannels);
      mockDatabase.channelMembership.findMany.mockResolvedValue(
        privateMemberships,
      );
      mockDatabase.directMessageGroupMember.findMany.mockResolvedValue(
        directMessages,
      );
      mockDatabase.aliasGroupMember.findMany.mockResolvedValue(aliasGroups);

      await service.joinAll(client as any, communityId);

      // User room + 1 public + 1 private + 1 DM + 1 alias = 5 join calls
      expect(client.join).toHaveBeenCalledTimes(5);
      expect(client.join).toHaveBeenCalledWith(userId); // User room
      expect(client.join).toHaveBeenCalledWith('public-1');
      expect(client.join).toHaveBeenCalledWith('private-1');
      expect(client.join).toHaveBeenCalledWith('dm-1');
      expect(client.join).toHaveBeenCalledWith('alias-1');
    });

    it('should handle empty results for all queries', async () => {
      const userId = 'user-empty';
      const communityId = 'community-empty';
      const client = createMockClient(userId);

      mockDatabase.channel.findMany.mockResolvedValue([]);
      mockDatabase.channelMembership.findMany.mockResolvedValue([]);
      mockDatabase.directMessageGroupMember.findMany.mockResolvedValue([]);
      mockDatabase.aliasGroupMember.findMany.mockResolvedValue([]);

      await service.joinAll(client as any, communityId);

      // Should only join user's own room
      expect(client.join).toHaveBeenCalledTimes(1);
      expect(client.join).toHaveBeenCalledWith(userId);
    });
  });

  describe('join', () => {
    it('should join a specific room', async () => {
      const client = createMockClient('user-123');
      const roomId = 'room-456';

      await service.join(client as any, roomId);

      expect(client.join).toHaveBeenCalledWith(roomId);
    });

    it('should join multiple rooms sequentially', async () => {
      const client = createMockClient('user-123');

      await service.join(client as any, 'room-1');
      await service.join(client as any, 'room-2');
      await service.join(client as any, 'room-3');

      expect(client.join).toHaveBeenCalledTimes(3);
      expect(client.join).toHaveBeenCalledWith('room-1');
      expect(client.join).toHaveBeenCalledWith('room-2');
      expect(client.join).toHaveBeenCalledWith('room-3');
    });
  });
});
