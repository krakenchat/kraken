import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: HealthService;

  const mockHealthService = {
    getHealthMetadata: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthService = module.get<HealthService>(HealthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return health metadata from service', () => {
      const mockMetadata = {
        status: 'ok',
        instanceName: 'Test Instance',
        version: '0.0.1',
        timestamp: new Date().toISOString(),
      };

      jest
        .spyOn(healthService, 'getHealthMetadata')
        .mockReturnValue(mockMetadata);

      const result = controller.check();

      expect(healthService.getHealthMetadata).toHaveBeenCalled();
      expect(result).toEqual(mockMetadata);
    });

    it('should call service method without arguments', () => {
      jest.spyOn(healthService, 'getHealthMetadata').mockReturnValue({
        status: 'ok',
        instanceName: 'Kraken Instance',
        version: '0.0.1',
        timestamp: new Date().toISOString(),
      });

      controller.check();

      expect(healthService.getHealthMetadata).toHaveBeenCalledWith();
    });

    it('should return fresh timestamp on each call', () => {
      const timestamp1 = new Date().toISOString();
      const timestamp2 = new Date().toISOString();

      jest
        .spyOn(healthService, 'getHealthMetadata')
        .mockReturnValueOnce({
          status: 'ok',
          instanceName: 'Kraken Instance',
          version: '0.0.1',
          timestamp: timestamp1,
        })
        .mockReturnValueOnce({
          status: 'ok',
          instanceName: 'Kraken Instance',
          version: '0.0.1',
          timestamp: timestamp2,
        });

      const result1 = controller.check();
      const result2 = controller.check();

      expect(result1.timestamp).toBe(timestamp1);
      expect(result2.timestamp).toBe(timestamp2);
      expect(healthService.getHealthMetadata).toHaveBeenCalledTimes(2);
    });
  });
});
