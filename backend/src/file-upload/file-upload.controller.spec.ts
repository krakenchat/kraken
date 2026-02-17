import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { FileUploadController } from './file-upload.controller';
import { FileUploadService } from './file-upload.service';

describe('FileUploadController', () => {
  let controller: FileUploadController;
  let service: Mocked<FileUploadService>;

  beforeEach(async () => {
    const { unit, unitRef } =
      await TestBed.solitary(FileUploadController).compile();

    controller = unit;
    service = unitRef.get(FileUploadService);
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

      service.uploadFile.mockResolvedValue(uploadedFile as any);

      const result = await controller.uploadFile(
        mockFile,
        mockBody as any,
        mockReq,
      );

      expect(result).toEqual(uploadedFile);
      expect(service.uploadFile).toHaveBeenCalledWith(
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

      service.remove.mockResolvedValue({ deleted: true } as any);

      const result = await controller.remove(fileId, mockReq);

      expect(result).toEqual({ deleted: true });
      expect(service.remove).toHaveBeenCalledWith(fileId, 'user-123');
    });
  });
});
