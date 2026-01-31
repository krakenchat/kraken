import { Test, TestingModule } from '@nestjs/testing';
import { PresenceService } from './presence.service';
import { REDIS_CLIENT } from '@/redis/redis.constants';

describe('PresenceService', () => {
  let service: PresenceService;
  let mockRedis: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockRedis = {
      sadd: jest.fn(),
      srem: jest.fn(),
      scard: jest.fn(),
      smembers: jest.fn(),
      expire: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresenceService,
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<PresenceService>(PresenceService);
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

      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.scard.mockResolvedValue(1); // First connection
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.addConnection(userId, connectionId);

      expect(result).toBe(true);
      expect(mockRedis.sadd).toHaveBeenCalledWith(
        'presence:connections:user-123',
        'conn-1',
      );
      expect(mockRedis.scard).toHaveBeenCalledWith(
        'presence:connections:user-123',
      );
      expect(mockRedis.sadd).toHaveBeenCalledWith(
        'presence:online-users',
        userId,
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        'presence:user:user-123',
        '1',
        'EX',
        60,
      );
    });

    it('should return false when adding subsequent connection (user already online)', async () => {
      const userId = 'user-456';
      const connectionId = 'conn-2';

      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.scard.mockResolvedValue(2); // Second connection
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.addConnection(userId, connectionId);

      expect(result).toBe(false);
      expect(mockRedis.sadd).toHaveBeenCalledWith(
        'presence:connections:user-456',
        'conn-2',
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        'presence:user:user-456',
        '1',
        'EX',
        60,
      );
    });

    it('should use custom TTL when provided', async () => {
      const userId = 'user-789';
      const connectionId = 'conn-3';
      const customTtl = 120;

      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.scard.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue('OK');

      await service.addConnection(userId, connectionId, customTtl);

      expect(mockRedis.expire).toHaveBeenCalledWith(
        'presence:connections:user-789',
        120,
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        'presence:user:user-789',
        '1',
        'EX',
        120,
      );
    });
  });

  describe('removeConnection', () => {
    it('should return true when removing last connection (user goes offline)', async () => {
      const userId = 'user-123';
      const connectionId = 'conn-1';

      mockRedis.srem.mockResolvedValue(1);
      mockRedis.scard.mockResolvedValue(0); // No connections left
      mockRedis.del.mockResolvedValue(1);

      const result = await service.removeConnection(userId, connectionId);

      expect(result).toBe(true);
      expect(mockRedis.srem).toHaveBeenCalledWith(
        'presence:connections:user-123',
        'conn-1',
      );
      expect(mockRedis.srem).toHaveBeenCalledWith(
        'presence:online-users',
        userId,
      );
      expect(mockRedis.del).toHaveBeenCalledWith('presence:user:user-123');
      expect(mockRedis.del).toHaveBeenCalledWith(
        'presence:connections:user-123',
      );
    });

    it('should return false when user still has other connections', async () => {
      const userId = 'user-456';
      const connectionId = 'conn-2';

      mockRedis.srem.mockResolvedValue(1);
      mockRedis.scard.mockResolvedValue(1); // Still has 1 connection

      const result = await service.removeConnection(userId, connectionId);

      expect(result).toBe(false);
      expect(mockRedis.srem).toHaveBeenCalledWith(
        'presence:connections:user-456',
        'conn-2',
      );
      expect(mockRedis.srem).toHaveBeenCalledTimes(1); // Only connection removal
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('refreshPresence', () => {
    it('should refresh TTL with default value', async () => {
      const userId = 'user-123';

      mockRedis.expire.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue('OK');

      await service.refreshPresence(userId);

      expect(mockRedis.expire).toHaveBeenCalledWith(
        'presence:connections:user-123',
        60,
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        'presence:user:user-123',
        '1',
        'EX',
        60,
      );
    });

    it('should refresh TTL with custom value', async () => {
      const userId = 'user-456';
      const customTtl = 300;

      mockRedis.expire.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue('OK');

      await service.refreshPresence(userId, customTtl);

      expect(mockRedis.expire).toHaveBeenCalledWith(
        'presence:connections:user-456',
        300,
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        'presence:user:user-456',
        '1',
        'EX',
        300,
      );
    });
  });

  describe('setOnline (deprecated)', () => {
    it('should mark user as online', async () => {
      const userId = 'user-123';

      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue('OK');

      await service.setOnline(userId);

      expect(mockRedis.sadd).toHaveBeenCalledWith(
        'presence:online-users',
        userId,
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        'presence:user:user-123',
        '1',
        'EX',
        60,
      );
    });

    it('should use custom TTL', async () => {
      const userId = 'user-456';
      const customTtl = 180;

      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue('OK');

      await service.setOnline(userId, customTtl);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'presence:user:user-456',
        '1',
        'EX',
        180,
      );
    });
  });

  describe('setOffline (deprecated)', () => {
    it('should mark user as offline and clean up data', async () => {
      const userId = 'user-123';

      mockRedis.srem.mockResolvedValue(1);
      mockRedis.del.mockResolvedValue(1);

      await service.setOffline(userId);

      expect(mockRedis.srem).toHaveBeenCalledWith(
        'presence:online-users',
        userId,
      );
      expect(mockRedis.del).toHaveBeenCalledWith('presence:user:user-123');
      expect(mockRedis.del).toHaveBeenCalledWith(
        'presence:connections:user-123',
      );
    });
  });

  describe('isOnline', () => {
    it('should return true when user is online', async () => {
      const userId = 'user-123';

      mockRedis.get.mockResolvedValue('1');

      const result = await service.isOnline(userId);

      expect(result).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith('presence:user:user-123');
    });

    it('should return false when user is offline', async () => {
      const userId = 'user-456';

      mockRedis.get.mockResolvedValue(null);

      const result = await service.isOnline(userId);

      expect(result).toBe(false);
      expect(mockRedis.get).toHaveBeenCalledWith('presence:user:user-456');
    });

    it('should return false when presence key does not exist', async () => {
      const userId = 'user-789';

      mockRedis.get.mockResolvedValue('');

      const result = await service.isOnline(userId);

      expect(result).toBe(false);
    });
  });

  describe('getOnlineUsers', () => {
    it('should return all online user IDs', async () => {
      const onlineUsers = ['user-1', 'user-2', 'user-3'];

      mockRedis.smembers.mockResolvedValue(onlineUsers);

      const result = await service.getOnlineUsers();

      expect(result).toEqual(onlineUsers);
      expect(mockRedis.smembers).toHaveBeenCalledWith('presence:online-users');
    });

    it('should return empty array when no users online', async () => {
      mockRedis.smembers.mockResolvedValue([]);

      const result = await service.getOnlineUsers();

      expect(result).toEqual([]);
    });
  });

  describe('cleanupExpired', () => {
    it('should remove users with expired presence keys', async () => {
      const onlineUsers = ['user-1', 'user-2', 'user-3'];

      mockRedis.smembers.mockResolvedValue(onlineUsers);
      mockRedis.get
        .mockResolvedValueOnce('1') // user-1 still has presence
        .mockResolvedValueOnce(null) // user-2 expired
        .mockResolvedValueOnce('1'); // user-3 still has presence

      mockRedis.srem.mockResolvedValue(1);
      mockRedis.del.mockResolvedValue(1);

      await service.cleanupExpired();

      // Should only remove user-2
      expect(mockRedis.srem).toHaveBeenCalledWith(
        'presence:online-users',
        'user-2',
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        'presence:connections:user-2',
      );
      expect(mockRedis.srem).toHaveBeenCalledTimes(1);
    });

    it('should not remove any users when all have valid presence', async () => {
      const onlineUsers = ['user-1', 'user-2'];

      mockRedis.smembers.mockResolvedValue(onlineUsers);
      mockRedis.get
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce('1');

      await service.cleanupExpired();

      expect(mockRedis.srem).not.toHaveBeenCalled();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should handle empty online users list', async () => {
      mockRedis.smembers.mockResolvedValue([]);

      await service.cleanupExpired();

      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(mockRedis.srem).not.toHaveBeenCalled();
    });
  });
});
