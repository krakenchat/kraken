import { Test, TestingModule } from '@nestjs/testing';
import { PresenceService } from './presence.service';
import { RedisService } from '@/redis/redis.service';

describe('PresenceService', () => {
  let service: PresenceService;
  let redisService: RedisService;

  const mockRedisClient = {
    sadd: jest.fn(),
    srem: jest.fn(),
    scard: jest.fn(),
    smembers: jest.fn(),
    expire: jest.fn(),
  };

  const mockRedisService = {
    getClient: jest.fn(() => mockRedisClient),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresenceService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<PresenceService>(PresenceService);
    redisService = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addConnection', () => {
    it('should return true when adding first connection (user goes online)', async () => {
      const userId = 'user-123';
      const connectionId = 'conn-1';

      mockRedisClient.sadd.mockResolvedValue(1);
      mockRedisClient.expire.mockResolvedValue(1);
      mockRedisClient.scard.mockResolvedValue(1); // First connection
      jest.spyOn(redisService, 'set').mockResolvedValue('OK');

      const result = await service.addConnection(userId, connectionId);

      expect(result).toBe(true);
      expect(mockRedisClient.sadd).toHaveBeenCalledWith(
        'presence:connections:user-123',
        'conn-1',
      );
      expect(mockRedisClient.scard).toHaveBeenCalledWith(
        'presence:connections:user-123',
      );
      expect(mockRedisClient.sadd).toHaveBeenCalledWith(
        'presence:online-users',
        userId,
      );
      expect(redisService.set).toHaveBeenCalledWith(
        'presence:user:user-123',
        '1',
        60,
      );
    });

    it('should return false when adding subsequent connection (user already online)', async () => {
      const userId = 'user-456';
      const connectionId = 'conn-2';

      mockRedisClient.sadd.mockResolvedValue(1);
      mockRedisClient.expire.mockResolvedValue(1);
      mockRedisClient.scard.mockResolvedValue(2); // Second connection
      jest.spyOn(redisService, 'set').mockResolvedValue('OK');

      const result = await service.addConnection(userId, connectionId);

      expect(result).toBe(false);
      expect(mockRedisClient.sadd).toHaveBeenCalledWith(
        'presence:connections:user-456',
        'conn-2',
      );
      expect(redisService.set).toHaveBeenCalledWith(
        'presence:user:user-456',
        '1',
        60,
      );
    });

    it('should use custom TTL when provided', async () => {
      const userId = 'user-789';
      const connectionId = 'conn-3';
      const customTtl = 120;

      mockRedisClient.sadd.mockResolvedValue(1);
      mockRedisClient.expire.mockResolvedValue(1);
      mockRedisClient.scard.mockResolvedValue(1);
      jest.spyOn(redisService, 'set').mockResolvedValue('OK');

      await service.addConnection(userId, connectionId, customTtl);

      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        'presence:connections:user-789',
        120,
      );
      expect(redisService.set).toHaveBeenCalledWith(
        'presence:user:user-789',
        '1',
        120,
      );
    });
  });

  describe('removeConnection', () => {
    it('should return true when removing last connection (user goes offline)', async () => {
      const userId = 'user-123';
      const connectionId = 'conn-1';

      mockRedisClient.srem.mockResolvedValue(1);
      mockRedisClient.scard.mockResolvedValue(0); // No connections left
      jest.spyOn(redisService, 'del').mockResolvedValue(1);

      const result = await service.removeConnection(userId, connectionId);

      expect(result).toBe(true);
      expect(mockRedisClient.srem).toHaveBeenCalledWith(
        'presence:connections:user-123',
        'conn-1',
      );
      expect(mockRedisClient.srem).toHaveBeenCalledWith(
        'presence:online-users',
        userId,
      );
      expect(redisService.del).toHaveBeenCalledWith('presence:user:user-123');
      expect(redisService.del).toHaveBeenCalledWith(
        'presence:connections:user-123',
      );
    });

    it('should return false when user still has other connections', async () => {
      const userId = 'user-456';
      const connectionId = 'conn-2';

      mockRedisClient.srem.mockResolvedValue(1);
      mockRedisClient.scard.mockResolvedValue(1); // Still has 1 connection

      const result = await service.removeConnection(userId, connectionId);

      expect(result).toBe(false);
      expect(mockRedisClient.srem).toHaveBeenCalledWith(
        'presence:connections:user-456',
        'conn-2',
      );
      expect(mockRedisClient.srem).toHaveBeenCalledTimes(1); // Only connection removal
      expect(redisService.del).not.toHaveBeenCalled();
    });
  });

  describe('refreshPresence', () => {
    it('should refresh TTL with default value', async () => {
      const userId = 'user-123';

      mockRedisClient.expire.mockResolvedValue(1);
      jest.spyOn(redisService, 'set').mockResolvedValue('OK');

      await service.refreshPresence(userId);

      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        'presence:connections:user-123',
        60,
      );
      expect(redisService.set).toHaveBeenCalledWith(
        'presence:user:user-123',
        '1',
        60,
      );
    });

    it('should refresh TTL with custom value', async () => {
      const userId = 'user-456';
      const customTtl = 300;

      mockRedisClient.expire.mockResolvedValue(1);
      jest.spyOn(redisService, 'set').mockResolvedValue('OK');

      await service.refreshPresence(userId, customTtl);

      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        'presence:connections:user-456',
        300,
      );
      expect(redisService.set).toHaveBeenCalledWith(
        'presence:user:user-456',
        '1',
        300,
      );
    });
  });

  describe('setOnline (deprecated)', () => {
    it('should mark user as online', async () => {
      const userId = 'user-123';

      mockRedisClient.sadd.mockResolvedValue(1);
      jest.spyOn(redisService, 'set').mockResolvedValue('OK');

      await service.setOnline(userId);

      expect(mockRedisClient.sadd).toHaveBeenCalledWith(
        'presence:online-users',
        userId,
      );
      expect(redisService.set).toHaveBeenCalledWith(
        'presence:user:user-123',
        '1',
        60,
      );
    });

    it('should use custom TTL', async () => {
      const userId = 'user-456';
      const customTtl = 180;

      mockRedisClient.sadd.mockResolvedValue(1);
      jest.spyOn(redisService, 'set').mockResolvedValue('OK');

      await service.setOnline(userId, customTtl);

      expect(redisService.set).toHaveBeenCalledWith(
        'presence:user:user-456',
        '1',
        180,
      );
    });
  });

  describe('setOffline (deprecated)', () => {
    it('should mark user as offline and clean up data', async () => {
      const userId = 'user-123';

      mockRedisClient.srem.mockResolvedValue(1);
      jest.spyOn(redisService, 'del').mockResolvedValue(1);

      await service.setOffline(userId);

      expect(mockRedisClient.srem).toHaveBeenCalledWith(
        'presence:online-users',
        userId,
      );
      expect(redisService.del).toHaveBeenCalledWith('presence:user:user-123');
      expect(redisService.del).toHaveBeenCalledWith(
        'presence:connections:user-123',
      );
    });
  });

  describe('isOnline', () => {
    it('should return true when user is online', async () => {
      const userId = 'user-123';

      jest.spyOn(redisService, 'get').mockResolvedValue('1');

      const result = await service.isOnline(userId);

      expect(result).toBe(true);
      expect(redisService.get).toHaveBeenCalledWith('presence:user:user-123');
    });

    it('should return false when user is offline', async () => {
      const userId = 'user-456';

      jest.spyOn(redisService, 'get').mockResolvedValue(null);

      const result = await service.isOnline(userId);

      expect(result).toBe(false);
      expect(redisService.get).toHaveBeenCalledWith('presence:user:user-456');
    });

    it('should return false when presence key does not exist', async () => {
      const userId = 'user-789';

      jest.spyOn(redisService, 'get').mockResolvedValue('');

      const result = await service.isOnline(userId);

      expect(result).toBe(false);
    });
  });

  describe('getOnlineUsers', () => {
    it('should return all online user IDs', async () => {
      const onlineUsers = ['user-1', 'user-2', 'user-3'];

      mockRedisClient.smembers.mockResolvedValue(onlineUsers);

      const result = await service.getOnlineUsers();

      expect(result).toEqual(onlineUsers);
      expect(mockRedisClient.smembers).toHaveBeenCalledWith(
        'presence:online-users',
      );
    });

    it('should return empty array when no users online', async () => {
      mockRedisClient.smembers.mockResolvedValue([]);

      const result = await service.getOnlineUsers();

      expect(result).toEqual([]);
    });
  });

  describe('cleanupExpired', () => {
    it('should remove users with expired presence keys', async () => {
      const onlineUsers = ['user-1', 'user-2', 'user-3'];

      mockRedisClient.smembers.mockResolvedValue(onlineUsers);
      jest
        .spyOn(redisService, 'get')
        .mockResolvedValueOnce('1') // user-1 still has presence
        .mockResolvedValueOnce(null) // user-2 expired
        .mockResolvedValueOnce('1'); // user-3 still has presence

      mockRedisClient.srem.mockResolvedValue(1);
      jest.spyOn(redisService, 'del').mockResolvedValue(1);

      await service.cleanupExpired();

      // Should only remove user-2
      expect(mockRedisClient.srem).toHaveBeenCalledWith(
        'presence:online-users',
        'user-2',
      );
      expect(redisService.del).toHaveBeenCalledWith(
        'presence:connections:user-2',
      );
      expect(mockRedisClient.srem).toHaveBeenCalledTimes(1);
    });

    it('should not remove any users when all have valid presence', async () => {
      const onlineUsers = ['user-1', 'user-2'];

      mockRedisClient.smembers.mockResolvedValue(onlineUsers);
      jest
        .spyOn(redisService, 'get')
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce('1');

      await service.cleanupExpired();

      expect(mockRedisClient.srem).not.toHaveBeenCalled();
      expect(redisService.del).not.toHaveBeenCalled();
    });

    it('should handle empty online users list', async () => {
      mockRedisClient.smembers.mockResolvedValue([]);

      await service.cleanupExpired();

      expect(redisService.get).not.toHaveBeenCalled();
      expect(mockRedisClient.srem).not.toHaveBeenCalled();
    });
  });
});
