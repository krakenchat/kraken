import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { DatabaseHealthIndicator } from './database.health-indicator';
import { DatabaseService } from '@/database/database.service';
import { HealthCheckError } from '@nestjs/terminus';

describe('DatabaseHealthIndicator', () => {
  let indicator: DatabaseHealthIndicator;
  let databaseService: Mocked<DatabaseService>;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(
      DatabaseHealthIndicator,
    ).compile();
    indicator = unit;
    databaseService = unitRef.get(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return up when database is reachable', async () => {
    databaseService.$executeRaw.mockResolvedValue(1);

    const result = await indicator.isHealthy('database');

    expect(result).toEqual({ database: { status: 'up' } });
  });

  it('should throw HealthCheckError when database is unreachable', async () => {
    databaseService.$executeRaw.mockRejectedValue(
      new Error('Connection refused'),
    );

    await expect(indicator.isHealthy('database')).rejects.toThrow(
      HealthCheckError,
    );
  });

  it('should include down status in error details', async () => {
    databaseService.$executeRaw.mockRejectedValue(new Error('timeout'));

    try {
      await indicator.isHealthy('database');
      fail('Expected HealthCheckError');
    } catch (error) {
      expect(error).toBeInstanceOf(HealthCheckError);
      expect((error as HealthCheckError).causes).toEqual({
        database: { status: 'down' },
      });
    }
  });

  it('should throw HealthCheckError when query times out', async () => {
    jest.useFakeTimers();

    databaseService.$executeRaw.mockReturnValue(
      new Promise(() => {}) as never,
    );

    const healthPromise = indicator.isHealthy('database');
    jest.advanceTimersByTime(3000);

    await expect(healthPromise).rejects.toThrow(HealthCheckError);

    jest.useRealTimers();
  });
});
