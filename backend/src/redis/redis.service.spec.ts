import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import { ConfigService } from '@nestjs/config';

// Mock ioredis module
jest.mock('ioredis', () => {
  const mockRedisInstance = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    expire: jest.fn(),
    quit: jest.fn().mockResolvedValue(undefined),
  };

  const MockRedisConstructor = jest.fn(() => mockRedisInstance);

  return {
    __esModule: true,
    default: MockRedisConstructor,
  };
});

describe('RedisService', () => {
  let service: RedisService;
  let configService: ConfigService;
  let mockRedisClient: any;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        REDIS_DB: '0',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
    configService = module.get<ConfigService>(ConfigService);

    // Initialize module to create Redis client
    service.onModuleInit();
    mockRedisClient = service.getClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have config service', () => {
    expect(configService).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize Redis client with default config', () => {
      const newService = new RedisService(configService);
      newService.onModuleInit();

      expect(configService.get).toHaveBeenCalledWith('REDIS_HOST');
      expect(configService.get).toHaveBeenCalledWith('REDIS_PORT');
      expect(configService.get).toHaveBeenCalledWith('REDIS_PASSWORD');
      expect(configService.get).toHaveBeenCalledWith('REDIS_DB');
    });

    it('should use provided config values', () => {
      const customConfig = {
        get: jest.fn((key: string) => {
          const config: Record<string, string> = {
            REDIS_HOST: 'custom-host',
            REDIS_PORT: '6380',
            REDIS_PASSWORD: 'secret',
            REDIS_DB: '5',
          };
          return config[key];
        }),
      };

      const newService = new RedisService(customConfig as any);
      newService.onModuleInit();

      expect(customConfig.get).toHaveBeenCalledWith('REDIS_HOST');
      expect(customConfig.get).toHaveBeenCalledWith('REDIS_PORT');
      expect(customConfig.get).toHaveBeenCalledWith('REDIS_PASSWORD');
      expect(customConfig.get).toHaveBeenCalledWith('REDIS_DB');
    });
  });

  describe('onModuleDestroy', () => {
    it('should quit Redis client on destroy', async () => {
      const quitSpy = jest.spyOn(mockRedisClient, 'quit');

      await service.onModuleDestroy();

      expect(quitSpy).toHaveBeenCalled();
    });

    it('should handle destroy when client is not initialized', async () => {
      const newService = new RedisService(configService);
      // Don't call onModuleInit

      await expect(newService.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  describe('get', () => {
    it('should get value from Redis', async () => {
      const key = 'test-key';
      const value = 'test-value';

      mockRedisClient.get.mockResolvedValue(value);

      const result = await service.get(key);

      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(result).toBe(value);
    });

    it('should return null when key does not exist', async () => {
      const key = 'nonexistent-key';

      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.get(key);

      expect(result).toBeNull();
    });

    it('should get different keys independently', async () => {
      mockRedisClient.get.mockImplementation((key: string) => {
        const data: Record<string, string> = {
          'key-1': 'value-1',
          'key-2': 'value-2',
          'key-3': 'value-3',
        };
        return Promise.resolve(data[key] || null);
      });

      const result1 = await service.get('key-1');
      const result2 = await service.get('key-2');
      const result3 = await service.get('key-3');

      expect(result1).toBe('value-1');
      expect(result2).toBe('value-2');
      expect(result3).toBe('value-3');
    });
  });

  describe('set', () => {
    it('should set value without expiration', async () => {
      const key = 'test-key';
      const value = 'test-value';

      mockRedisClient.set.mockResolvedValue('OK');

      const result = await service.set(key, value);

      expect(mockRedisClient.set).toHaveBeenCalledWith(key, value);
      expect(result).toBe('OK');
    });

    it('should set value with expiration', async () => {
      const key = 'test-key';
      const value = 'test-value';
      const expireSeconds = 3600;

      mockRedisClient.set.mockResolvedValue('OK');

      const result = await service.set(key, value, expireSeconds);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        key,
        value,
        'EX',
        expireSeconds,
      );
      expect(result).toBe('OK');
    });

    it('should set different expiration times', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      await service.set('key-1', 'value-1', 60);
      await service.set('key-2', 'value-2', 300);
      await service.set('key-3', 'value-3', 86400);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'key-1',
        'value-1',
        'EX',
        60,
      );
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'key-2',
        'value-2',
        'EX',
        300,
      );
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'key-3',
        'value-3',
        'EX',
        86400,
      );
    });

    it('should handle set operation returning null', async () => {
      const key = 'test-key';
      const value = 'test-value';

      mockRedisClient.set.mockResolvedValue(null);

      const result = await service.set(key, value);

      expect(result).toBeNull();
    });
  });

  describe('del', () => {
    it('should delete a key and return 1', async () => {
      const key = 'test-key';

      mockRedisClient.del.mockResolvedValue(1);

      const result = await service.del(key);

      expect(mockRedisClient.del).toHaveBeenCalledWith(key);
      expect(result).toBe(1);
    });

    it('should return 0 when deleting non-existent key', async () => {
      const key = 'nonexistent-key';

      mockRedisClient.del.mockResolvedValue(0);

      const result = await service.del(key);

      expect(result).toBe(0);
    });

    it('should delete multiple different keys', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await service.del('key-1');
      await service.del('key-2');
      await service.del('key-3');

      expect(mockRedisClient.del).toHaveBeenCalledTimes(3);
      expect(mockRedisClient.del).toHaveBeenCalledWith('key-1');
      expect(mockRedisClient.del).toHaveBeenCalledWith('key-2');
      expect(mockRedisClient.del).toHaveBeenCalledWith('key-3');
    });
  });

  describe('expire', () => {
    it('should set expiration on a key', async () => {
      const key = 'test-key';
      const seconds = 3600;

      mockRedisClient.expire.mockResolvedValue(1);

      const result = await service.expire(key, seconds);

      expect(mockRedisClient.expire).toHaveBeenCalledWith(key, seconds);
      expect(result).toBe(1);
    });

    it('should return 0 when setting expiration on non-existent key', async () => {
      const key = 'nonexistent-key';
      const seconds = 3600;

      mockRedisClient.expire.mockResolvedValue(0);

      const result = await service.expire(key, seconds);

      expect(result).toBe(0);
    });

    it('should set different expiration times on different keys', async () => {
      mockRedisClient.expire.mockResolvedValue(1);

      await service.expire('key-1', 60);
      await service.expire('key-2', 300);
      await service.expire('key-3', 86400);

      expect(mockRedisClient.expire).toHaveBeenCalledTimes(3);
      expect(mockRedisClient.expire).toHaveBeenCalledWith('key-1', 60);
      expect(mockRedisClient.expire).toHaveBeenCalledWith('key-2', 300);
      expect(mockRedisClient.expire).toHaveBeenCalledWith('key-3', 86400);
    });
  });

  describe('getClient', () => {
    it('should return the Redis client instance', () => {
      const client = service.getClient();

      expect(client).toBeDefined();
      expect(client).toBe(mockRedisClient);
    });

    it('should return client with expected methods', () => {
      const client = service.getClient();

      expect(client.get).toBeDefined();
      expect(client.set).toBeDefined();
      expect(client.del).toBeDefined();
      expect(client.expire).toBeDefined();
      expect(client.quit).toBeDefined();
    });
  });
});
