import { Test, TestingModule } from '@nestjs/testing';
import { VoicePresenceService } from './voice-presence.service';
import { RedisService } from '@/redis/redis.service';
import { WebsocketService } from '@/websocket/websocket.service';
import { DatabaseService } from '@/database/database.service';
import { LivekitReplayService } from '@/livekit/livekit-replay.service';
import { UserFactory } from '@/test-utils';
import { ServerEvents } from '@/websocket/events.enum/server-events.enum';

describe('VoicePresenceService', () => {
  let service: VoicePresenceService;
  let redisService: RedisService;
  let websocketService: WebsocketService;
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

  const mockDatabaseService = {
    directMessageGroup: {
      findFirst: jest.fn(),
    },
  };

  const mockLivekitReplayService = {
    stopReplayBuffer: jest.fn(),
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
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: LivekitReplayService,
          useValue: mockLivekitReplayService,
        },
      ],
    }).compile();

    service = module.get<VoicePresenceService>(VoicePresenceService);
    redisService = module.get<RedisService>(RedisService);
    websocketService = module.get<WebsocketService>(WebsocketService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('leaveVoiceChannel', () => {
    it('should leave voice channel successfully', async () => {
      const channelId = 'channel-123';
      const userId = 'user-123';
      const userData = {
        id: userId,
        username: 'testuser',
        joinedAt: new Date().toISOString(),
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
        isDeafened: false,
      };
      const user2Data = {
        id: 'user-2',
        username: 'user2',
        joinedAt: new Date('2024-01-01T10:05:00Z'),
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
          isDeafened: false,
        }),
        JSON.stringify({
          id: 'user-2',
          username: 'user2',
          joinedAt: earlierTime,
          isDeafened: false,
        }),
        JSON.stringify({
          id: 'user-3',
          username: 'user3',
          joinedAt: middleTime,
          isDeafened: false,
        }),
      ]);

      const result = await service.getChannelPresence(channelId);

      expect(result[0].id).toBe('user-2'); // Earliest
      expect(result[1].id).toBe('user-3'); // Middle
      expect(result[2].id).toBe('user-1'); // Latest
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

  describe('leaveDmVoice', () => {
    it('should leave DM voice successfully', async () => {
      const dmGroupId = 'dm-group-123';
      const userId = 'user-123';
      const userData = {
        id: userId,
        username: 'testuser',
        joinedAt: new Date().toISOString(),
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
        isDeafened: false,
      };
      const user2Data = {
        id: 'user-2',
        username: 'user2',
        joinedAt: new Date('2024-01-01T10:05:00Z'),
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
});
