import { Test, TestingModule } from '@nestjs/testing';
import { VoicePresenceService } from './voice-presence.service';
import { RedisService } from '@/redis/redis.service';
import { WebsocketService } from '@/websocket/websocket.service';
import { ChannelsService } from '@/channels/channels.service';
import { DatabaseService } from '@/database/database.service';
import { UserFactory, ChannelFactory } from '@/test-utils';
import { ServerEvents } from '@/websocket/events.enum/server-events.enum';

describe('VoicePresenceService', () => {
  let service: VoicePresenceService;
  let redisService: RedisService;
  let websocketService: WebsocketService;
  let channelsService: ChannelsService;
  let databaseService: DatabaseService;

  const mockRedisClient = {
    pipeline: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnThis(),
      sadd: jest.fn().mockReturnThis(),
      srem: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    }),
    smembers: jest.fn(),
    mget: jest.fn(),
    srem: jest.fn(),
  };

  const mockRedisService = {
    getClient: jest.fn(() => mockRedisClient),
    get: jest.fn(),
    set: jest.fn(),
    expire: jest.fn(),
  };

  const mockWebsocketService = {
    sendToRoom: jest.fn(),
  };

  const mockChannelsService = {
    findOne: jest.fn(),
  };

  const mockDatabaseService = {
    directMessageGroup: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoicePresenceService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: WebsocketService,
          useValue: mockWebsocketService,
        },
        {
          provide: ChannelsService,
          useValue: mockChannelsService,
        },
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<VoicePresenceService>(VoicePresenceService);
    redisService = module.get<RedisService>(RedisService);
    websocketService = module.get<WebsocketService>(WebsocketService);
    channelsService = module.get<ChannelsService>(ChannelsService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('joinVoiceChannel', () => {
    it('should join voice channel successfully', async () => {
      const channelId = 'channel-123';
      const user = UserFactory.build();
      const mockChannel = ChannelFactory.build({ id: channelId });

      jest.spyOn(channelsService, 'findOne').mockResolvedValue(mockChannel);

      await service.joinVoiceChannel(channelId, user);

      expect(channelsService.findOne).toHaveBeenCalledWith(channelId);
      expect(mockRedisClient.pipeline).toHaveBeenCalled();
      expect(websocketService.sendToRoom).toHaveBeenCalledWith(
        channelId,
        ServerEvents.VOICE_CHANNEL_USER_JOINED,
        expect.objectContaining({
          channelId,
          user: expect.objectContaining({
            id: user.id,
            username: user.username,
            isVideoEnabled: false,
            isScreenSharing: false,
            isMuted: false,
            isDeafened: false,
          }),
        }),
      );
    });

    it('should store user data with correct initial state', async () => {
      const channelId = 'channel-456';
      const user = UserFactory.build({
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
      });
      const mockChannel = ChannelFactory.build({ id: channelId });

      jest.spyOn(channelsService, 'findOne').mockResolvedValue(mockChannel);

      const pipelineMock = mockRedisClient.pipeline();

      await service.joinVoiceChannel(channelId, user);

      expect(pipelineMock.set).toHaveBeenCalledWith(
        expect.stringContaining(`voice_presence:user:${channelId}:${user.id}`),
        expect.stringContaining(user.username),
        'EX',
        300,
      );
      expect(pipelineMock.sadd).toHaveBeenCalledTimes(2);
      expect(pipelineMock.exec).toHaveBeenCalled();
    });

    it('should throw error when channel verification fails', async () => {
      const channelId = 'invalid-channel';
      const user = UserFactory.build();

      jest
        .spyOn(channelsService, 'findOne')
        .mockRejectedValue(new Error('Channel not found'));

      await expect(service.joinVoiceChannel(channelId, user)).rejects.toThrow(
        'Channel not found',
      );

      expect(websocketService.sendToRoom).not.toHaveBeenCalled();
    });
  });

  describe('leaveVoiceChannel', () => {
    it('should leave voice channel successfully', async () => {
      const channelId = 'channel-123';
      const userId = 'user-123';
      const userData = {
        id: userId,
        username: 'testuser',
        joinedAt: new Date().toISOString(),
        isVideoEnabled: false,
        isScreenSharing: false,
        isMuted: false,
        isDeafened: false,
      };

      jest
        .spyOn(redisService, 'get')
        .mockResolvedValue(JSON.stringify(userData));

      await service.leaveVoiceChannel(channelId, userId);

      expect(mockRedisClient.pipeline).toHaveBeenCalled();
      expect(websocketService.sendToRoom).toHaveBeenCalledWith(
        channelId,
        ServerEvents.VOICE_CHANNEL_USER_LEFT,
        {
          channelId,
          userId,
          user: userData,
        },
      );
    });

    it('should handle user not found gracefully', async () => {
      const channelId = 'channel-123';
      const userId = 'nonexistent-user';

      jest.spyOn(redisService, 'get').mockResolvedValue(null);

      await service.leaveVoiceChannel(channelId, userId);

      expect(mockRedisClient.pipeline).not.toHaveBeenCalled();
      expect(websocketService.sendToRoom).not.toHaveBeenCalled();
    });

    it('should clean up Redis data correctly', async () => {
      const channelId = 'channel-789';
      const userId = 'user-789';
      const userData = {
        id: userId,
        username: 'testuser',
        joinedAt: new Date(),
        isVideoEnabled: false,
        isScreenSharing: false,
        isMuted: false,
        isDeafened: false,
      };

      jest
        .spyOn(redisService, 'get')
        .mockResolvedValue(JSON.stringify(userData));

      const pipelineMock = mockRedisClient.pipeline();

      await service.leaveVoiceChannel(channelId, userId);

      expect(pipelineMock.del).toHaveBeenCalledWith(
        expect.stringContaining(`voice_presence:user:${channelId}:${userId}`),
      );
      expect(pipelineMock.srem).toHaveBeenCalledTimes(2);
      expect(pipelineMock.exec).toHaveBeenCalled();
    });
  });

  describe('getChannelPresence', () => {
    it('should return all users in voice channel', async () => {
      const channelId = 'channel-123';
      const userIds = ['user-1', 'user-2'];
      const user1Data = {
        id: 'user-1',
        username: 'user1',
        joinedAt: new Date('2024-01-01T10:00:00Z'),
        isVideoEnabled: true,
        isScreenSharing: false,
        isMuted: false,
        isDeafened: false,
      };
      const user2Data = {
        id: 'user-2',
        username: 'user2',
        joinedAt: new Date('2024-01-01T10:05:00Z'),
        isVideoEnabled: false,
        isScreenSharing: true,
        isMuted: false,
        isDeafened: false,
      };

      mockRedisClient.smembers.mockResolvedValue(userIds);
      mockRedisClient.mget.mockResolvedValue([
        JSON.stringify(user1Data),
        JSON.stringify(user2Data),
      ]);

      const result = await service.getChannelPresence(channelId);

      expect(mockRedisClient.smembers).toHaveBeenCalledWith(
        expect.stringContaining(`voice_presence:channel:${channelId}:members`),
      );
      expect(mockRedisClient.mget).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('user-1');
      expect(result[1].id).toBe('user-2');
    });

    it('should return empty array when no users in channel', async () => {
      const channelId = 'empty-channel';

      mockRedisClient.smembers.mockResolvedValue([]);

      const result = await service.getChannelPresence(channelId);

      expect(result).toEqual([]);
      expect(mockRedisClient.mget).not.toHaveBeenCalled();
    });

    it('should clean up expired user data', async () => {
      const channelId = 'channel-456';
      const userIds = ['user-1', 'user-2'];

      mockRedisClient.smembers.mockResolvedValue(userIds);
      mockRedisClient.mget.mockResolvedValue([
        JSON.stringify({
          id: 'user-1',
          username: 'user1',
          joinedAt: new Date(),
          isVideoEnabled: false,
          isScreenSharing: false,
          isMuted: false,
          isDeafened: false,
        }),
        null, // User 2 data expired
      ]);

      const result = await service.getChannelPresence(channelId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('user-1');
      expect(mockRedisClient.srem).toHaveBeenCalledWith(
        expect.stringContaining(`voice_presence:channel:${channelId}:members`),
        'user-2',
      );
    });

    it('should sort users by join time', async () => {
      const channelId = 'channel-789';
      const userIds = ['user-1', 'user-2', 'user-3'];
      const laterTime = new Date('2024-01-01T12:00:00Z');
      const earlierTime = new Date('2024-01-01T10:00:00Z');
      const middleTime = new Date('2024-01-01T11:00:00Z');

      mockRedisClient.smembers.mockResolvedValue(userIds);
      mockRedisClient.mget.mockResolvedValue([
        JSON.stringify({
          id: 'user-1',
          username: 'user1',
          joinedAt: laterTime,
          isVideoEnabled: false,
          isScreenSharing: false,
          isMuted: false,
          isDeafened: false,
        }),
        JSON.stringify({
          id: 'user-2',
          username: 'user2',
          joinedAt: earlierTime,
          isVideoEnabled: false,
          isScreenSharing: false,
          isMuted: false,
          isDeafened: false,
        }),
        JSON.stringify({
          id: 'user-3',
          username: 'user3',
          joinedAt: middleTime,
          isVideoEnabled: false,
          isScreenSharing: false,
          isMuted: false,
          isDeafened: false,
        }),
      ]);

      const result = await service.getChannelPresence(channelId);

      expect(result[0].id).toBe('user-2'); // Earliest
      expect(result[1].id).toBe('user-3'); // Middle
      expect(result[2].id).toBe('user-1'); // Latest
    });
  });

  describe('updateVoiceState', () => {
    it('should update voice state successfully', async () => {
      const channelId = 'channel-123';
      const userId = 'user-123';
      const existingData = {
        id: userId,
        username: 'testuser',
        joinedAt: new Date().toISOString(),
        isVideoEnabled: false,
        isScreenSharing: false,
        isMuted: false,
        isDeafened: false,
      };
      const updates = {
        isVideoEnabled: true,
        isScreenSharing: true,
      };

      jest
        .spyOn(redisService, 'get')
        .mockResolvedValue(JSON.stringify(existingData));
      jest.spyOn(redisService, 'set').mockResolvedValue('OK');

      await service.updateVoiceState(channelId, userId, updates);

      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringContaining(`voice_presence:user:${channelId}:${userId}`),
        expect.stringContaining('"isVideoEnabled":true'),
        300,
      );
      expect(websocketService.sendToRoom).toHaveBeenCalledWith(
        channelId,
        ServerEvents.VOICE_CHANNEL_USER_UPDATED,
        {
          channelId,
          userId,
          user: {
            ...existingData,
            ...updates,
          },
          updates,
        },
      );
    });

    it('should handle user not found gracefully', async () => {
      const channelId = 'channel-123';
      const userId = 'nonexistent-user';
      const updates = { isMuted: true };

      jest.spyOn(redisService, 'get').mockResolvedValue(null);

      await service.updateVoiceState(channelId, userId, updates);

      expect(redisService.set).not.toHaveBeenCalled();
      expect(websocketService.sendToRoom).not.toHaveBeenCalled();
    });

    it('should update only specified fields', async () => {
      const channelId = 'channel-456';
      const userId = 'user-456';
      const existingData = {
        id: userId,
        username: 'testuser',
        joinedAt: new Date(),
        isVideoEnabled: true,
        isScreenSharing: false,
        isMuted: false,
        isDeafened: false,
      };
      const updates = { isMuted: true };

      jest
        .spyOn(redisService, 'get')
        .mockResolvedValue(JSON.stringify(existingData));
      jest.spyOn(redisService, 'set').mockResolvedValue('OK');

      await service.updateVoiceState(channelId, userId, updates);

      const setCall = (redisService.set as jest.Mock).mock.calls[0];
      const savedData = JSON.parse(setCall[1]);

      expect(savedData.isMuted).toBe(true);
      expect(savedData.isVideoEnabled).toBe(true); // Unchanged
      expect(savedData.isScreenSharing).toBe(false); // Unchanged
    });
  });

  describe('refreshPresence', () => {
    it('should refresh TTL for user presence', async () => {
      const channelId = 'channel-123';
      const userId = 'user-123';

      jest.spyOn(redisService, 'expire').mockResolvedValue(1);

      await service.refreshPresence(channelId, userId);

      expect(redisService.expire).toHaveBeenCalledWith(
        expect.stringContaining(`voice_presence:user:${channelId}:${userId}`),
        300,
      );
    });

    it('should not throw error on failure', async () => {
      const channelId = 'channel-123';
      const userId = 'user-123';

      jest
        .spyOn(redisService, 'expire')
        .mockRejectedValue(new Error('Redis error'));

      await expect(
        service.refreshPresence(channelId, userId),
      ).resolves.not.toThrow();
    });
  });

  describe('cleanupExpiredPresence', () => {
    it('should execute without errors', () => {
      expect(() => service.cleanupExpiredPresence()).not.toThrow();
    });
  });

  describe('getUserVoiceChannels', () => {
    it('should return all channels user is in', async () => {
      const userId = 'user-123';
      const channelIds = ['channel-1', 'channel-2', 'channel-3'];

      mockRedisClient.smembers.mockResolvedValue(channelIds);

      const result = await service.getUserVoiceChannels(userId);

      expect(mockRedisClient.smembers).toHaveBeenCalledWith(
        expect.stringContaining(`voice_presence:user_channels:${userId}`),
      );
      expect(result).toEqual(channelIds);
    });

    it('should return empty array when user not in any channels', async () => {
      const userId = 'user-456';

      mockRedisClient.smembers.mockResolvedValue([]);

      const result = await service.getUserVoiceChannels(userId);

      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      const userId = 'user-789';

      mockRedisClient.smembers.mockRejectedValue(new Error('Redis error'));

      const result = await service.getUserVoiceChannels(userId);

      expect(result).toEqual([]);
    });
  });

  describe('joinDmVoice', () => {
    it('should join DM voice as first user and trigger ringing', async () => {
      const dmGroupId = 'dm-group-123';
      const user = UserFactory.build();
      const mockDmGroup = {
        id: dmGroupId,
        members: [{ userId: user.id, user }],
      };

      jest
        .spyOn(databaseService.directMessageGroup, 'findFirst')
        .mockResolvedValue(mockDmGroup as any);
      mockRedisClient.smembers.mockResolvedValue([]); // No existing members

      await service.joinDmVoice(dmGroupId, user);

      expect(databaseService.directMessageGroup.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: dmGroupId,
          }),
        }),
      );
      expect(websocketService.sendToRoom).toHaveBeenCalledWith(
        dmGroupId,
        ServerEvents.DM_VOICE_CALL_STARTED,
        expect.objectContaining({
          dmGroupId,
          startedBy: user.id,
        }),
      );
    });

    it('should join DM voice as non-first user without ringing', async () => {
      const dmGroupId = 'dm-group-456';
      const user = UserFactory.build();
      const mockDmGroup = {
        id: dmGroupId,
        members: [{ userId: user.id, user }],
      };

      jest
        .spyOn(databaseService.directMessageGroup, 'findFirst')
        .mockResolvedValue(mockDmGroup as any);
      mockRedisClient.smembers.mockResolvedValue(['other-user-id']); // Existing member

      await service.joinDmVoice(dmGroupId, user);

      expect(websocketService.sendToRoom).toHaveBeenCalledWith(
        dmGroupId,
        ServerEvents.DM_VOICE_USER_JOINED,
        expect.objectContaining({
          dmGroupId,
          user: expect.objectContaining({
            id: user.id,
          }),
        }),
      );
    });

    it('should throw error when DM group not found', async () => {
      const dmGroupId = 'invalid-dm';
      const user = UserFactory.build();

      jest
        .spyOn(databaseService.directMessageGroup, 'findFirst')
        .mockResolvedValue(null);

      await expect(service.joinDmVoice(dmGroupId, user)).rejects.toThrow(
        'DM group not found or user is not a member',
      );

      expect(websocketService.sendToRoom).not.toHaveBeenCalled();
    });

    it('should store user data in Redis correctly', async () => {
      const dmGroupId = 'dm-group-789';
      const user = UserFactory.build();
      const mockDmGroup = {
        id: dmGroupId,
        members: [{ userId: user.id, user }],
      };

      jest
        .spyOn(databaseService.directMessageGroup, 'findFirst')
        .mockResolvedValue(mockDmGroup as any);
      mockRedisClient.smembers.mockResolvedValue([]);

      const pipelineMock = mockRedisClient.pipeline();

      await service.joinDmVoice(dmGroupId, user);

      expect(pipelineMock.set).toHaveBeenCalledWith(
        expect.stringContaining(
          `dm_voice_presence:user:${dmGroupId}:${user.id}`,
        ),
        expect.stringContaining(user.username),
        'EX',
        300,
      );
      expect(pipelineMock.sadd).toHaveBeenCalledTimes(2);
      expect(pipelineMock.exec).toHaveBeenCalled();
    });
  });

  describe('leaveDmVoice', () => {
    it('should leave DM voice successfully', async () => {
      const dmGroupId = 'dm-group-123';
      const userId = 'user-123';
      const userData = {
        id: userId,
        username: 'testuser',
        joinedAt: new Date().toISOString(),
        isVideoEnabled: false,
        isScreenSharing: false,
        isMuted: false,
        isDeafened: false,
      };

      jest
        .spyOn(redisService, 'get')
        .mockResolvedValue(JSON.stringify(userData));

      await service.leaveDmVoice(dmGroupId, userId);

      expect(mockRedisClient.pipeline).toHaveBeenCalled();
      expect(websocketService.sendToRoom).toHaveBeenCalledWith(
        dmGroupId,
        ServerEvents.DM_VOICE_USER_LEFT,
        {
          dmGroupId,
          userId,
          user: userData,
        },
      );
    });

    it('should handle user not found gracefully', async () => {
      const dmGroupId = 'dm-group-456';
      const userId = 'nonexistent-user';

      jest.spyOn(redisService, 'get').mockResolvedValue(null);

      await service.leaveDmVoice(dmGroupId, userId);

      expect(mockRedisClient.pipeline).not.toHaveBeenCalled();
      expect(websocketService.sendToRoom).not.toHaveBeenCalled();
    });
  });

  describe('getDmPresence', () => {
    it('should return all users in DM voice call', async () => {
      const dmGroupId = 'dm-group-123';
      const userIds = ['user-1', 'user-2'];
      const user1Data = {
        id: 'user-1',
        username: 'user1',
        joinedAt: new Date('2024-01-01T10:00:00Z'),
        isVideoEnabled: false,
        isScreenSharing: false,
        isMuted: false,
        isDeafened: false,
      };
      const user2Data = {
        id: 'user-2',
        username: 'user2',
        joinedAt: new Date('2024-01-01T10:05:00Z'),
        isVideoEnabled: true,
        isScreenSharing: false,
        isMuted: false,
        isDeafened: false,
      };

      mockRedisClient.smembers.mockResolvedValue(userIds);
      mockRedisClient.mget.mockResolvedValue([
        JSON.stringify(user1Data),
        JSON.stringify(user2Data),
      ]);

      const result = await service.getDmPresence(dmGroupId);

      expect(mockRedisClient.smembers).toHaveBeenCalledWith(
        expect.stringContaining(`dm_voice_presence:dm:${dmGroupId}:members`),
      );
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('user-1');
      expect(result[1].id).toBe('user-2');
    });

    it('should return empty array when no users in DM call', async () => {
      const dmGroupId = 'empty-dm';

      mockRedisClient.smembers.mockResolvedValue([]);

      const result = await service.getDmPresence(dmGroupId);

      expect(result).toEqual([]);
      expect(mockRedisClient.mget).not.toHaveBeenCalled();
    });

    it('should clean up expired DM user data', async () => {
      const dmGroupId = 'dm-group-456';
      const userIds = ['user-1', 'user-2'];

      mockRedisClient.smembers.mockResolvedValue(userIds);
      mockRedisClient.mget.mockResolvedValue([
        JSON.stringify({
          id: 'user-1',
          username: 'user1',
          joinedAt: new Date(),
          isVideoEnabled: false,
          isScreenSharing: false,
          isMuted: false,
          isDeafened: false,
        }),
        null, // User 2 data expired
      ]);

      const result = await service.getDmPresence(dmGroupId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('user-1');
      expect(mockRedisClient.srem).toHaveBeenCalledWith(
        expect.stringContaining(`dm_voice_presence:dm:${dmGroupId}:members`),
        'user-2',
      );
    });
  });

  describe('updateDmVoiceState', () => {
    it('should update DM voice state successfully', async () => {
      const dmGroupId = 'dm-group-123';
      const userId = 'user-123';
      const existingData = {
        id: userId,
        username: 'testuser',
        joinedAt: new Date().toISOString(),
        isVideoEnabled: false,
        isScreenSharing: false,
        isMuted: false,
        isDeafened: false,
      };
      const updates = {
        isVideoEnabled: true,
        isMuted: true,
      };

      jest
        .spyOn(redisService, 'get')
        .mockResolvedValue(JSON.stringify(existingData));
      jest.spyOn(redisService, 'set').mockResolvedValue('OK');

      await service.updateDmVoiceState(dmGroupId, userId, updates);

      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringContaining(
          `dm_voice_presence:user:${dmGroupId}:${userId}`,
        ),
        expect.stringContaining('"isVideoEnabled":true'),
        300,
      );
      expect(websocketService.sendToRoom).toHaveBeenCalledWith(
        dmGroupId,
        ServerEvents.DM_VOICE_USER_UPDATED,
        {
          dmGroupId,
          userId,
          user: {
            ...existingData,
            ...updates,
          },
          updates,
        },
      );
    });

    it('should handle user not found gracefully', async () => {
      const dmGroupId = 'dm-group-456';
      const userId = 'nonexistent-user';
      const updates = { isDeafened: true };

      jest.spyOn(redisService, 'get').mockResolvedValue(null);

      await service.updateDmVoiceState(dmGroupId, userId, updates);

      expect(redisService.set).not.toHaveBeenCalled();
      expect(websocketService.sendToRoom).not.toHaveBeenCalled();
    });
  });
});
