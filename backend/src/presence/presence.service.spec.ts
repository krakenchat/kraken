import { Test, TestingModule } from '@nestjs/testing';
import { PresenceService } from './presence.service';
import { RedisService } from '@/redis/redis.service';

describe('PresenceService', () => {
  let service: PresenceService;
  let redisService: RedisService;

  const mockRedisService = {
    getClient: jest.fn(() => ({
      sadd: jest.fn(),
      srem: jest.fn(),
      scard: jest.fn(),
      smembers: jest.fn(),
      expire: jest.fn(),
    })),
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

  it('should have redis service', () => {
    expect(redisService).toBeDefined();
  });
});
