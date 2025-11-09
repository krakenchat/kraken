import { Test, TestingModule } from '@nestjs/testing';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { FileAccessGuard } from '@/file/file-access/file-access.guard';

describe('FileController', () => {
  let controller: FileController;
  let service: FileService;

  const mockFileService = {
    findOne: jest.fn(),
    markForDeletion: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileController],
      providers: [
        {
          provide: FileService,
          useValue: mockFileService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(FileAccessGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<FileController>(FileController);
    service = module.get<FileService>(FileService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should have a service', () => {
    expect(service).toBeDefined();
  });
});
