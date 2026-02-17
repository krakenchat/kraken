import { TestBed } from '@suites/unit';
import { HealthService } from './health.service';
import { REDIS_CLIENT } from '@/redis/redis.constants';
import { createMockRedis } from '@/test-utils';

describe('HealthService', () => {
  let service: HealthService;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(async () => {
    mockRedis = createMockRedis();

    const { unit } = await TestBed.solitary(HealthService)
      .mock(REDIS_CLIENT)
      .final(mockRedis)
      .compile();

    service = unit;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should load instance name from Redis on initialization', async () => {
      mockRedis.get.mockResolvedValue('My Custom Instance');

      await service.onModuleInit();

      expect(mockRedis.get).toHaveBeenCalledWith('instance:name');
      expect(service.getInstanceName()).toBe('My Custom Instance');
    });

    it('should use default name when Redis returns null', async () => {
      mockRedis.get.mockResolvedValue(null);

      await service.onModuleInit();

      expect(mockRedis.get).toHaveBeenCalledWith('instance:name');
      expect(service.getInstanceName()).toBe('Kraken Instance');
    });

    it('should use default name when Redis throws error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      await service.onModuleInit();

      expect(service.getInstanceName()).toBe('Kraken Instance');
    });

    it('should log when instance name is loaded successfully', async () => {
      mockRedis.get.mockResolvedValue('Prod Instance');
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.onModuleInit();

      expect(loggerSpy).toHaveBeenCalledWith(
        'Loaded instance name from Redis: Prod Instance',
      );
    });

    it('should log when no instance name found in Redis', async () => {
      mockRedis.get.mockResolvedValue(null);
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.onModuleInit();

      expect(loggerSpy).toHaveBeenCalledWith(
        'No instance name found in Redis, using default: Kraken Instance',
      );
    });

    it('should log error when Redis fails', async () => {
      const error = new Error('Connection timeout');
      mockRedis.get.mockRejectedValue(error);
      const loggerSpy = jest.spyOn(service['logger'], 'error');

      await service.onModuleInit();

      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to load instance name from Redis',
        error,
      );
    });
  });

  describe('getInstanceName', () => {
    it('should return cached instance name', () => {
      const name = service.getInstanceName();

      expect(name).toBe('Kraken Instance');
      expect(mockRedis.get).not.toHaveBeenCalled(); // Should not call Redis
    });

    it('should return updated name after onModuleInit', async () => {
      mockRedis.get.mockResolvedValue('Updated Name');
      await service.onModuleInit();

      const name = service.getInstanceName();

      expect(name).toBe('Updated Name');
    });
  });

  describe('getHealthMetadata', () => {
    it('should return health metadata with correct structure', () => {
      const metadata = service.getHealthMetadata();

      expect(metadata).toHaveProperty('status');
      expect(metadata).toHaveProperty('instanceName');
      expect(metadata).toHaveProperty('version');
      expect(metadata).toHaveProperty('timestamp');
    });

    it('should return status as ok', () => {
      const metadata = service.getHealthMetadata();

      expect(metadata.status).toBe('ok');
    });

    it('should return default instance name', () => {
      const metadata = service.getHealthMetadata();

      expect(metadata.instanceName).toBe('Kraken Instance');
    });

    it('should return updated instance name after initialization', async () => {
      mockRedis.get.mockResolvedValue('Custom Instance');
      await service.onModuleInit();

      const metadata = service.getHealthMetadata();

      expect(metadata.instanceName).toBe('Custom Instance');
    });

    it('should return timestamp as ISO string', () => {
      const metadata = service.getHealthMetadata();

      expect(metadata.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it('should return current timestamp on each call', () => {
      const metadata1 = service.getHealthMetadata();
      const metadata2 = service.getHealthMetadata();

      // Timestamps should be very close but may differ slightly
      expect(new Date(metadata1.timestamp).getTime()).toBeLessThanOrEqual(
        new Date(metadata2.timestamp).getTime(),
      );
    });

    it('should not call Redis for metadata', () => {
      service.getHealthMetadata();

      expect(mockRedis.get).not.toHaveBeenCalled();
    });
  });
});
