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
      expect(service.getInstanceName()).toBe('Semaphore Chat Instance');
    });

    it('should use default name when Redis throws error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      await service.onModuleInit();

      expect(service.getInstanceName()).toBe('Semaphore Chat Instance');
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
        'No instance name found in Redis, using default: Semaphore Chat Instance',
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

      expect(name).toBe('Semaphore Chat Instance');
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should return updated name after onModuleInit', async () => {
      mockRedis.get.mockResolvedValue('Updated Name');
      await service.onModuleInit();

      const name = service.getInstanceName();

      expect(name).toBe('Updated Name');
    });
  });
});
