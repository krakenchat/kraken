import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { FileService } from './file.service';
import { DatabaseService } from '@/database/database.service';
import { StorageService } from '@/storage/storage.service';
import type { IStorageProvider } from '@/storage/interfaces/storage-provider.interface';

describe('FileService', () => {
  let service: FileService;
  let databaseService: Mocked<DatabaseService>;
  let storageService: Mocked<StorageService>;
  let mockProvider: jest.Mocked<IStorageProvider>;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(FileService).compile();

    service = unit;
    databaseService = unitRef.get(DatabaseService);
    storageService = unitRef.get(StorageService);

    // Reset mocks
    jest.clearAllMocks();

    // Per-record provider resolution: cleanupOldFiles calls
    // storageService.getProvider(file.storageType) and operates on the
    // returned provider directly (never the ambient/local-only wrappers).
    mockProvider = {
      writeStream: jest.fn(),
      getReadStream: jest.fn(),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      fileExists: jest.fn(),
      getFileStats: jest.fn(),
      getFileUrl: jest.fn(),
    };
    storageService.getProvider.mockReturnValue(mockProvider);
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

      databaseService.file.findUniqueOrThrow.mockResolvedValue(mockFile as any);

      const result = await service.findOne(fileId);

      expect(result).toEqual(mockFile);
      expect(databaseService.file.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: fileId, deletedAt: null },
      });
    });

    it('should throw error if file not found', async () => {
      const fileId = 'non-existent';

      databaseService.file.findUniqueOrThrow.mockRejectedValue(
        new Error('File not found'),
      );

      await expect(service.findOne(fileId)).rejects.toThrow('File not found');
    });
  });

  describe('markForDeletion', () => {
    it('should mark a file for deletion', async () => {
      const fileId = 'file-456';

      databaseService.file.update.mockResolvedValue({
        id: fileId,
        deletedAt: new Date(),
      } as any);

      await service.markForDeletion(fileId);

      expect(databaseService.file.update).toHaveBeenCalledWith({
        where: { id: fileId },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should not throw error if file update fails', async () => {
      const fileId = 'file-789';

      databaseService.file.update.mockRejectedValue(
        new Error('File not found'),
      );

      // Should not throw - just logs warning
      await expect(service.markForDeletion(fileId)).resolves.toBeUndefined();
    });

    it('should use transaction client when provided', async () => {
      const fileId = 'file-tx';
      const mockTxClient = {
        file: {
          update: jest.fn().mockResolvedValue({
            id: fileId,
            deletedAt: new Date(),
          }),
        },
      };

      await service.markForDeletion(fileId, mockTxClient as any);

      // Should use tx client instead of databaseService
      expect(mockTxClient.file.update).toHaveBeenCalledWith({
        where: { id: fileId },
        data: { deletedAt: expect.any(Date) },
      });
      expect(databaseService.file.update).not.toHaveBeenCalled();
    });

    it('should handle multiple mark for deletion calls', async () => {
      const fileIds = ['file-1', 'file-2', 'file-3'];

      for (const fileId of fileIds) {
        databaseService.file.update.mockResolvedValue({
          id: fileId,
          deletedAt: new Date(),
        } as any);

        await service.markForDeletion(fileId);

        expect(databaseService.file.update).toHaveBeenCalledWith({
          where: { id: fileId },
          data: { deletedAt: expect.any(Date) },
        });
      }
    });
  });

  describe('cleanupOldFiles', () => {
    it('should cleanup deleted files from local storage via the LOCAL provider', async () => {
      const deletedFiles = [
        {
          id: 'file-1',
          storageType: 'LOCAL',
          storagePath: '/tmp/file1.png',
          thumbnailPath: null,
          deletedAt: new Date(),
        },
        {
          id: 'file-2',
          storageType: 'LOCAL',
          storagePath: '/tmp/file2.png',
          thumbnailPath: null,
          deletedAt: new Date(),
        },
      ];

      databaseService.file.findMany.mockResolvedValue(deletedFiles as any);
      databaseService.file.delete.mockResolvedValue({ id: 'file-1' } as any);

      await service.cleanupOldFiles();

      expect(databaseService.file.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: { not: null },
        },
      });

      expect(storageService.getProvider).toHaveBeenCalledWith('LOCAL');
      expect(mockProvider.deleteFile).toHaveBeenCalledWith('/tmp/file1.png');
      expect(mockProvider.deleteFile).toHaveBeenCalledWith('/tmp/file2.png');
      expect(mockProvider.deleteFile).toHaveBeenCalledTimes(2);

      expect(databaseService.file.delete).toHaveBeenCalledWith({
        where: { id: 'file-1' },
      });
      expect(databaseService.file.delete).toHaveBeenCalledWith({
        where: { id: 'file-2' },
      });
    });

    it('should clean up S3-backed files via the S3 provider (per-record resolution)', async () => {
      const deletedFiles = [
        {
          id: 'file-s3',
          storageType: 'S3',
          storagePath: 'abc123def456',
          thumbnailPath: null,
          deletedAt: new Date(),
        },
      ];

      databaseService.file.findMany.mockResolvedValue(deletedFiles as any);
      databaseService.file.delete.mockResolvedValue({ id: 'file-s3' } as any);

      await service.cleanupOldFiles();

      expect(storageService.getProvider).toHaveBeenCalledWith('S3');
      expect(mockProvider.deleteFile).toHaveBeenCalledWith('abc123def456');
      expect(databaseService.file.delete).toHaveBeenCalledWith({
        where: { id: 'file-s3' },
      });
    });

    it('should also clean up the thumbnail object when present, via the same provider', async () => {
      const deletedFiles = [
        {
          id: 'file-video',
          storageType: 'S3',
          storagePath: 'video-key',
          thumbnailPath: 'thumbnails/file-video.jpg',
          deletedAt: new Date(),
        },
      ];

      databaseService.file.findMany.mockResolvedValue(deletedFiles as any);
      databaseService.file.delete.mockResolvedValue({} as any);

      await service.cleanupOldFiles();

      expect(mockProvider.deleteFile).toHaveBeenCalledWith('video-key');
      expect(mockProvider.deleteFile).toHaveBeenCalledWith(
        'thumbnails/file-video.jpg',
      );
      expect(databaseService.file.delete).toHaveBeenCalledWith({
        where: { id: 'file-video' },
      });
    });

    it('should still delete the DB row when thumbnail cleanup fails (non-fatal)', async () => {
      const deletedFiles = [
        {
          id: 'file-video',
          storageType: 'LOCAL',
          storagePath: '/tmp/video.mp4',
          thumbnailPath: '/tmp/thumbnails/file-video.jpg',
          deletedAt: new Date(),
        },
      ];

      databaseService.file.findMany.mockResolvedValue(deletedFiles as any);
      databaseService.file.delete.mockResolvedValue({} as any);
      mockProvider.deleteFile.mockImplementation((key: string) =>
        key.includes('thumbnails')
          ? Promise.reject(new Error('thumbnail already gone'))
          : Promise.resolve(),
      );

      await expect(service.cleanupOldFiles()).resolves.toBeUndefined();

      expect(databaseService.file.delete).toHaveBeenCalledWith({
        where: { id: 'file-video' },
      });
    });

    it('should skip files without storage path', async () => {
      const deletedFiles = [
        {
          id: 'file-no-path',
          storageType: 'LOCAL',
          storagePath: null,
          thumbnailPath: null,
          deletedAt: new Date(),
        },
      ];

      databaseService.file.findMany.mockResolvedValue(deletedFiles as any);

      await service.cleanupOldFiles();

      expect(storageService.getProvider).not.toHaveBeenCalled();
      expect(mockProvider.deleteFile).not.toHaveBeenCalled();
      expect(databaseService.file.delete).not.toHaveBeenCalled();
    });

    it('should continue on error and process remaining files', async () => {
      const deletedFiles = [
        {
          id: 'file-error',
          storageType: 'LOCAL',
          storagePath: '/tmp/error.png',
          thumbnailPath: null,
          deletedAt: new Date(),
        },
        {
          id: 'file-success',
          storageType: 'LOCAL',
          storagePath: '/tmp/success.png',
          thumbnailPath: null,
          deletedAt: new Date(),
        },
      ];

      databaseService.file.findMany.mockResolvedValue(deletedFiles as any);
      mockProvider.deleteFile
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce(undefined);

      await service.cleanupOldFiles();

      // Should have attempted both files
      expect(mockProvider.deleteFile).toHaveBeenCalledWith('/tmp/error.png');
      expect(mockProvider.deleteFile).toHaveBeenCalledWith('/tmp/success.png');

      // Only successful file should be deleted from DB
      expect(databaseService.file.delete).toHaveBeenCalledTimes(1);
      expect(databaseService.file.delete).toHaveBeenCalledWith({
        where: { id: 'file-success' },
      });
    });

    it('should handle empty deleted files list', async () => {
      databaseService.file.findMany.mockResolvedValue([]);

      await service.cleanupOldFiles();

      expect(mockProvider.deleteFile).not.toHaveBeenCalled();
      expect(databaseService.file.delete).not.toHaveBeenCalled();
    });

    it('should continue if database delete fails', async () => {
      const deletedFiles = [
        {
          id: 'file-db-error',
          storageType: 'LOCAL',
          storagePath: '/tmp/file.png',
          thumbnailPath: null,
          deletedAt: new Date(),
        },
      ];

      databaseService.file.findMany.mockResolvedValue(deletedFiles as any);
      databaseService.file.delete.mockRejectedValue(
        new Error('DB delete failed'),
      );

      // Should not throw - just logs error
      await expect(service.cleanupOldFiles()).resolves.toBeUndefined();

      expect(mockProvider.deleteFile).toHaveBeenCalledWith('/tmp/file.png');
    });
  });
});
