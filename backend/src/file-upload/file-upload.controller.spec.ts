import { Test, TestingModule } from '@nestjs/testing';
import { FileUploadController } from './file-upload.controller';
import { FileUploadService } from './file-upload.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';

describe('FileUploadController', () => {
  let controller: FileUploadController;
  let service: FileUploadService;

  const mockFileUploadService = {
    uploadFile: jest.fn(),
    remove: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileUploadController],
      providers: [
        {
          provide: FileUploadService,
          useValue: mockFileUploadService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<FileUploadController>(FileUploadController);
    service = module.get<FileUploadService>(FileUploadService);
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

  describe('uploadFile', () => {
    it('should upload a file', async () => {
      const mockFile = {
        fieldname: 'file',
        originalname: 'test.png',
        encoding: '7bit',
        mimetype: 'image/png',
        buffer: Buffer.from('test'),
        size: 1234,
      } as Express.Multer.File;

      const mockBody = {
        resourceType: 'USER_PROFILE',
        resourceId: 'user-123',
      };

      const mockUser = { id: 'user-123', username: 'testuser' };
      const mockReq = { user: mockUser } as any;

      const uploadedFile = {
        id: 'file-123',
        filename: 'test.png',
        mimeType: 'image/png',
        size: 1234,
      };

      mockFileUploadService.uploadFile.mockResolvedValue(uploadedFile);

      const result = await controller.uploadFile(
        mockFile,
        mockBody as any,
        mockReq,
      );

      expect(result).toEqual(uploadedFile);
      expect(mockFileUploadService.uploadFile).toHaveBeenCalledWith(
        mockFile,
        mockBody,
        mockUser,
      );
    });
  });

  describe('remove', () => {
    it('should remove a file', async () => {
      const fileId = 'file-456';
      const mockReq = { user: { id: 'user-123' } } as any;

      mockFileUploadService.remove.mockResolvedValue({ deleted: true });

      const result = await controller.remove(fileId, mockReq);

      expect(result).toEqual({ deleted: true });
      expect(mockFileUploadService.remove).toHaveBeenCalledWith(
        fileId,
        'user-123',
      );
    });
  });
});
