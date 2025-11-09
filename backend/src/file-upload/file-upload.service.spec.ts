/* eslint-disable @typescript-eslint/no-require-imports */
import { Test, TestingModule } from '@nestjs/testing';
import { FileUploadService } from './file-upload.service';
import { DatabaseService } from '@/database/database.service';
import { UnprocessableEntityException } from '@nestjs/common';
import { ResourceType, FileType, StorageType } from '@prisma/client';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';

jest.mock('fs/promises');
jest.mock('./validators/resource-type-file.validator');

describe('FileUploadService', () => {
  let service: FileUploadService;
  let databaseService: DatabaseService;

  const mockDatabaseService = {
    file: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
  } as any;

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 1024,
    destination: '/tmp',
    filename: 'test-123.png',
    path: '/tmp/test-123.png',
    buffer: Buffer.from('test'),
    stream: null as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileUploadService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<FileUploadService>(FileUploadService);
    databaseService = module.get<DatabaseService>(DatabaseService);

    // Reset mocks
    jest.clearAllMocks();

    // Default mock implementations
    (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('test'));
    (fs.unlink as jest.Mock).mockResolvedValue(undefined);

    // Mock crypto
    const mockHash = {
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('abc123def456'),
    };
    jest.spyOn(crypto, 'createHash').mockReturnValue(mockHash as any);
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

  describe('uploadFile', () => {
    it('should successfully upload a valid file', async () => {
      const createDto = {
        resourceType: ResourceType.MESSAGE_ATTACHMENT,
        resourceId: 'msg-123',
      };

      const createdFile = {
        id: 'file-123',
        filename: 'test.png',
        mimeType: 'image/png',
        size: 1024,
        checksum: 'abc123def456',
      };

      mockDatabaseService.file.create.mockResolvedValue(createdFile);

      // Mock validator to pass

      const {
        ResourceTypeFileValidator,
      } = require('./validators/resource-type-file.validator');
      ResourceTypeFileValidator.mockImplementation(() => ({
        isValid: jest.fn().mockResolvedValue(true),
      }));

      const result = await service.uploadFile(mockFile, createDto, mockUser);

      expect(result).toEqual(createdFile);
      expect(mockDatabaseService.file.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          resourceType: ResourceType.MESSAGE_ATTACHMENT,
          resourceId: 'msg-123',
          filename: 'test.png',
          mimeType: 'image/png',
          fileType: FileType.IMAGE,
          size: 1024,
          checksum: 'abc123def456',
          uploadedById: 'user-123',
          storageType: StorageType.LOCAL,
          storagePath: '/tmp/test-123.png',
        }),
      });
    });

    it('should throw error and cleanup file when validation fails', async () => {
      const createDto = {
        resourceType: ResourceType.MESSAGE_ATTACHMENT,
        resourceId: 'msg-123',
      };

      // Mock validator to fail

      const {
        ResourceTypeFileValidator,
      } = require('./validators/resource-type-file.validator');
      ResourceTypeFileValidator.mockImplementation(() => ({
        isValid: jest.fn().mockResolvedValue(false),
        buildErrorMessage: jest.fn().mockReturnValue('File validation failed'),
      }));

      await expect(
        service.uploadFile(mockFile, createDto, mockUser),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(fs.unlink).toHaveBeenCalledWith('/tmp/test-123.png');
      expect(mockDatabaseService.file.create).not.toHaveBeenCalled();
    });

    it('should cleanup file if database insert fails', async () => {
      const createDto = {
        resourceType: ResourceType.MESSAGE_ATTACHMENT,
        resourceId: 'msg-123',
      };

      // Mock validator to pass

      const {
        ResourceTypeFileValidator,
      } = require('./validators/resource-type-file.validator');
      ResourceTypeFileValidator.mockImplementation(() => ({
        isValid: jest.fn().mockResolvedValue(true),
      }));

      mockDatabaseService.file.create.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.uploadFile(mockFile, createDto, mockUser),
      ).rejects.toThrow('Database error');

      expect(fs.unlink).toHaveBeenCalledWith('/tmp/test-123.png');
    });

    it('should handle video file type', async () => {
      const videoFile = {
        ...mockFile,
        originalname: 'test.mp4',
        mimetype: 'video/mp4',
      };

      const createDto = {
        resourceType: ResourceType.MESSAGE_ATTACHMENT,
        resourceId: 'msg-123',
      };

      mockDatabaseService.file.create.mockResolvedValue({ id: 'file-123' });

      const {
        ResourceTypeFileValidator,
      } = require('./validators/resource-type-file.validator');
      ResourceTypeFileValidator.mockImplementation(() => ({
        isValid: jest.fn().mockResolvedValue(true),
      }));

      await service.uploadFile(videoFile, createDto, mockUser);

      expect(mockDatabaseService.file.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fileType: FileType.VIDEO,
        }),
      });
    });

    it('should handle audio file type', async () => {
      const audioFile = {
        ...mockFile,
        originalname: 'test.mp3',
        mimetype: 'audio/mpeg',
      };

      const createDto = {
        resourceType: ResourceType.MESSAGE_ATTACHMENT,
        resourceId: 'msg-123',
      };

      mockDatabaseService.file.create.mockResolvedValue({ id: 'file-123' });

      const {
        ResourceTypeFileValidator,
      } = require('./validators/resource-type-file.validator');
      ResourceTypeFileValidator.mockImplementation(() => ({
        isValid: jest.fn().mockResolvedValue(true),
      }));

      await service.uploadFile(audioFile, createDto, mockUser);

      expect(mockDatabaseService.file.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fileType: FileType.AUDIO,
        }),
      });
    });

    it('should handle document file types', async () => {
      const documentTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'text/plain',
      ];

      for (const mimeType of documentTypes) {
        const docFile = {
          ...mockFile,
          mimetype: mimeType,
        };

        const createDto = {
          resourceType: ResourceType.MESSAGE_ATTACHMENT,
          resourceId: 'msg-123',
        };

        mockDatabaseService.file.create.mockResolvedValue({ id: 'file-123' });

        const {
          ResourceTypeFileValidator,
        } = require('./validators/resource-type-file.validator');
        ResourceTypeFileValidator.mockImplementation(() => ({
          isValid: jest.fn().mockResolvedValue(true),
        }));

        await service.uploadFile(docFile, createDto, mockUser);

        expect(mockDatabaseService.file.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            fileType: FileType.DOCUMENT,
          }),
        });

        jest.clearAllMocks();
      }
    });

    it('should handle archive file types as OTHER', async () => {
      const archiveTypes = [
        'application/zip',
        'application/x-rar-compressed',
        'application/x-7z-compressed',
        'application/octet-stream',
      ];

      for (const mimeType of archiveTypes) {
        const archiveFile = {
          ...mockFile,
          mimetype: mimeType,
        };

        const createDto = {
          resourceType: ResourceType.MESSAGE_ATTACHMENT,
          resourceId: 'msg-123',
        };

        mockDatabaseService.file.create.mockResolvedValue({ id: 'file-123' });

        const {
          ResourceTypeFileValidator,
        } = require('./validators/resource-type-file.validator');
        ResourceTypeFileValidator.mockImplementation(() => ({
          isValid: jest.fn().mockResolvedValue(true),
        }));

        await service.uploadFile(archiveFile, createDto, mockUser);

        expect(mockDatabaseService.file.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            fileType: FileType.OTHER,
          }),
        });

        jest.clearAllMocks();
      }
    });

    it('should generate correct checksum', async () => {
      const createDto = {
        resourceType: ResourceType.MESSAGE_ATTACHMENT,
        resourceId: 'msg-123',
      };

      mockDatabaseService.file.create.mockResolvedValue({ id: 'file-123' });

      const {
        ResourceTypeFileValidator,
      } = require('./validators/resource-type-file.validator');
      ResourceTypeFileValidator.mockImplementation(() => ({
        isValid: jest.fn().mockResolvedValue(true),
      }));

      await service.uploadFile(mockFile, createDto, mockUser);

      expect(fs.readFile).toHaveBeenCalledWith('/tmp/test-123.png');
      expect(crypto.createHash).toHaveBeenCalledWith('sha256');
      expect(mockDatabaseService.file.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          checksum: 'abc123def456',
        }),
      });
    });
  });

  describe('remove', () => {
    it('should soft delete a file', async () => {
      const fileId = 'file-123';
      const deletedFile = { id: fileId, deletedAt: new Date() };

      mockDatabaseService.file.update.mockResolvedValue(deletedFile);

      const result = await service.remove(fileId);

      expect(result).toEqual(deletedFile);
      expect(mockDatabaseService.file.update).toHaveBeenCalledWith({
        where: { id: fileId },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should handle multiple file removals', async () => {
      const fileIds = ['file-1', 'file-2', 'file-3'];

      for (const fileId of fileIds) {
        mockDatabaseService.file.update.mockResolvedValue({
          id: fileId,
          deletedAt: new Date(),
        });

        await service.remove(fileId);

        expect(mockDatabaseService.file.update).toHaveBeenCalledWith({
          where: { id: fileId },
          data: { deletedAt: expect.any(Date) },
        });
      }
    });
  });
});
