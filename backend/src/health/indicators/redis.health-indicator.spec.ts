import { TestBed } from '@suites/unit';
import { RedisHealthIndicator } from './redis.health-indicator';
import { REDIS_CLIENT } from '@/redis/redis.constants';
import { createMockRedis } from '@/test-utils';
import { HealthCheckError } from '@nestjs/terminus';

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(async () => {
    mockRedis = createMockRedis();

    const { unit } = await TestBed.solitary(RedisHealthIndicator)
      .mock(REDIS_CLIENT)
      .final(mockRedis)
      .compile();

    indicator = unit;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return up when Redis is reachable', async () => {
    const result = await indicator.isHealthy('redis');

    expect(result).toEqual({ redis: { status: 'up' } });
    expect(mockRedis.ping).toHaveBeenCalled();
  });

  it('should throw HealthCheckError when Redis is unreachable', async () => {
    mockRedis.ping.mockRejectedValue(new Error('Connection refused'));

    await expect(indicator.isHealthy('redis')).rejects.toThrow(
      HealthCheckError,
    );
  });

  it('should include down status in error details', async () => {
    mockRedis.ping.mockRejectedValue(new Error('timeout'));

    try {
      await indicator.isHealthy('redis');
      fail('Expected HealthCheckError');
    } catch (error) {
      expect(error).toBeInstanceOf(HealthCheckError);
      expect((error as HealthCheckError).causes).toEqual({
        redis: { status: 'down' },
      });
    }
  });

  it('should throw HealthCheckError when ping times out', async () => {
    jest.useFakeTimers();

    mockRedis.ping.mockReturnValue(new Promise(() => {}));

    const healthPromise = indicator.isHealthy('redis');
    jest.advanceTimersByTime(3000);

    await expect(healthPromise).rejects.toThrow(HealthCheckError);

    jest.useRealTimers();
  });
});
