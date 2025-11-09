import { Test, TestingModule } from '@nestjs/testing';
import { FileService } from './file.service';
import { DatabaseService } from '@/database/database.service';
import * as fs from 'fs/promises';

jest.mock('fs/promises');

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

    // Reset mocks
    jest.clearAllMocks();

    // Default mock for unlink
    (fs.unlink as jest.Mock).mockResolvedValue(undefined);
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

  describe('findOne', () => {
    it('should find a file by id', async () => {
      const fileId = 'file-123';
      const mockFile = {
        id: fileId,
        filename: 'test.png',
        mimeType: 'image/png',
        size: 1024,
      };

      mockDatabaseService.file.findUniqueOrThrow.mockResolvedValue(mockFile);

      const result = await service.findOne(fileId);

      expect(result).toEqual(mockFile);
      expect(mockDatabaseService.file.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: fileId },
      });
    });

    it('should throw error if file not found', async () => {
      const fileId = 'non-existent';

      mockDatabaseService.file.findUniqueOrThrow.mockRejectedValue(
        new Error('File not found'),
      );

      await expect(service.findOne(fileId)).rejects.toThrow('File not found');
    });
  });

  describe('markForDeletion', () => {
    it('should mark a file for deletion', async () => {
      const fileId = 'file-456';

      mockDatabaseService.file.update.mockResolvedValue({
        id: fileId,
        deletedAt: new Date(),
      });

      await service.markForDeletion(fileId);

      expect(mockDatabaseService.file.update).toHaveBeenCalledWith({
        where: { id: fileId },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should not throw error if file update fails', async () => {
      const fileId = 'file-789';

      mockDatabaseService.file.update.mockRejectedValue(
        new Error('File not found'),
      );

      // Should not throw - just logs warning
      await expect(service.markForDeletion(fileId)).resolves.toBeUndefined();
    });

    it('should handle multiple mark for deletion calls', async () => {
      const fileIds = ['file-1', 'file-2', 'file-3'];

      for (const fileId of fileIds) {
        mockDatabaseService.file.update.mockResolvedValue({
          id: fileId,
          deletedAt: new Date(),
        });

        await service.markForDeletion(fileId);

        expect(mockDatabaseService.file.update).toHaveBeenCalledWith({
          where: { id: fileId },
          data: { deletedAt: expect.any(Date) },
        });
      }
    });
  });

  describe('cleanupOldFiles', () => {
    it('should cleanup deleted files from local storage', async () => {
      const deletedFiles = [
        {
          id: 'file-1',
          storageType: 'LOCAL',
          storagePath: '/tmp/file1.png',
          deletedAt: new Date(),
        },
        {
          id: 'file-2',
          storageType: 'LOCAL',
          storagePath: '/tmp/file2.png',
          deletedAt: new Date(),
        },
      ];

      mockDatabaseService.file.findMany.mockResolvedValue(deletedFiles);
      mockDatabaseService.file.delete.mockResolvedValue({ id: 'file-1' });

      await service.cleanupOldFiles();

      expect(mockDatabaseService.file.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: { not: null },
        },
      });

      expect(fs.unlink).toHaveBeenCalledWith('/tmp/file1.png');
      expect(fs.unlink).toHaveBeenCalledWith('/tmp/file2.png');
      expect(fs.unlink).toHaveBeenCalledTimes(2);

      expect(mockDatabaseService.file.delete).toHaveBeenCalledWith({
        where: { id: 'file-1' },
      });
      expect(mockDatabaseService.file.delete).toHaveBeenCalledWith({
        where: { id: 'file-2' },
      });
    });

    it('should skip non-LOCAL storage files', async () => {
      const deletedFiles = [
        {
          id: 'file-s3',
          storageType: 'S3',
          storagePath: 's3://bucket/file.png',
          deletedAt: new Date(),
        },
      ];

      mockDatabaseService.file.findMany.mockResolvedValue(deletedFiles);

      await service.cleanupOldFiles();

      expect(fs.unlink).not.toHaveBeenCalled();
      expect(mockDatabaseService.file.delete).not.toHaveBeenCalled();
    });

    it('should skip files without storage path', async () => {
      const deletedFiles = [
        {
          id: 'file-no-path',
          storageType: 'LOCAL',
          storagePath: null,
          deletedAt: new Date(),
        },
      ];

      mockDatabaseService.file.findMany.mockResolvedValue(deletedFiles);

      await service.cleanupOldFiles();

      expect(fs.unlink).not.toHaveBeenCalled();
      expect(mockDatabaseService.file.delete).not.toHaveBeenCalled();
    });

    it('should continue on error and process remaining files', async () => {
      const deletedFiles = [
        {
          id: 'file-error',
          storageType: 'LOCAL',
          storagePath: '/tmp/error.png',
          deletedAt: new Date(),
        },
        {
          id: 'file-success',
          storageType: 'LOCAL',
          storagePath: '/tmp/success.png',
          deletedAt: new Date(),
        },
      ];

      mockDatabaseService.file.findMany.mockResolvedValue(deletedFiles);
      (fs.unlink as jest.Mock)
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce(undefined);

      await service.cleanupOldFiles();

      // Should have attempted both files
      expect(fs.unlink).toHaveBeenCalledWith('/tmp/error.png');
      expect(fs.unlink).toHaveBeenCalledWith('/tmp/success.png');

      // Only successful file should be deleted from DB
      expect(mockDatabaseService.file.delete).toHaveBeenCalledTimes(1);
      expect(mockDatabaseService.file.delete).toHaveBeenCalledWith({
        where: { id: 'file-success' },
      });
    });

    it('should handle empty deleted files list', async () => {
      mockDatabaseService.file.findMany.mockResolvedValue([]);

      await service.cleanupOldFiles();

      expect(fs.unlink).not.toHaveBeenCalled();
      expect(mockDatabaseService.file.delete).not.toHaveBeenCalled();
    });

    it('should continue if database delete fails', async () => {
      const deletedFiles = [
        {
          id: 'file-db-error',
          storageType: 'LOCAL',
          storagePath: '/tmp/file.png',
          deletedAt: new Date(),
        },
      ];

      mockDatabaseService.file.findMany.mockResolvedValue(deletedFiles);
      mockDatabaseService.file.delete.mockRejectedValue(
        new Error('DB delete failed'),
      );

      // Should not throw - just logs error
      await expect(service.cleanupOldFiles()).resolves.toBeUndefined();

      expect(fs.unlink).toHaveBeenCalledWith('/tmp/file.png');
    });
  });
});
