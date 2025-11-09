import { Test, TestingModule } from '@nestjs/testing';
import { RoomsService } from './rooms.service';
import { DatabaseService } from '@/database/database.service';

describe('RoomsService', () => {
  let service: RoomsService;
  let databaseService: DatabaseService;

  const mockDatabaseService = {
    channel: {
      findMany: jest.fn(),
    },
    channelMembership: {
      findMany: jest.fn(),
    },
    directMessageGroup: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<RoomsService>(RoomsService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have database service', () => {
    expect(databaseService).toBeDefined();
  });
});
