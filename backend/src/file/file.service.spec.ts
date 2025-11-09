import { Test, TestingModule } from '@nestjs/testing';
import { FileService } from './file.service';
import { DatabaseService } from '@/database/database.service';

describe('FileService', () => {
  let service: FileService;
  let databaseService: DatabaseService;

  const mockDatabaseService = {
    file: {
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<FileService>(FileService);
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
