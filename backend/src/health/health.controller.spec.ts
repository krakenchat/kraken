import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { HealthController } from './health.controller';
import { HealthCheckService } from '@nestjs/terminus';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: Mocked<HealthCheckService>;

  beforeEach(async () => {
    const { unit, unitRef } =
      await TestBed.solitary(HealthController).compile();
    controller = unit;
    healthCheckService = unitRef.get(HealthCheckService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should delegate to HealthCheckService with redis and database checks', async () => {
      const mockResult = {
        status: 'ok' as const,
        info: {
          redis: { status: 'up' as const },
          database: { status: 'up' as const },
        },
        error: {},
        details: {
          redis: { status: 'up' as const },
          database: { status: 'up' as const },
        },
      };
      healthCheckService.check.mockResolvedValue(mockResult);

      const result = await controller.check();

      expect(result).toEqual(mockResult);
      expect(healthCheckService.check).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(Function)]),
      );
    });
  });
});
