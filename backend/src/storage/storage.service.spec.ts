import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { ConfigService } from '@nestjs/config';
import { StorageService, StorageType } from './storage.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';

describe('StorageService', () => {
  let service: StorageService;
  let localProvider: Mocked<LocalStorageProvider>;
  let s3Provider: Mocked<S3StorageProvider>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const { unit, unitRef } = await TestBed.solitary(StorageService)
      .mock(ConfigService)
      .final({
        get: jest.fn().mockReturnValue(undefined),
      })
      .compile();

    service = unit;
    localProvider = unitRef.get(LocalStorageProvider);
    s3Provider = unitRef.get(S3StorageProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialization', () => {
    it('should default to LOCAL storage type when not configured', () => {
      const provider = service.getProvider();
      expect(provider).toBe(localProvider);
    });

    it('should use configured storage type from environment', async () => {
      const { unit: svc, unitRef: ref } = await TestBed.solitary(StorageService)
        .mock(ConfigService)
        .final({
          get: jest.fn().mockReturnValue(StorageType.LOCAL),
        })
        .compile();

      const mockLocalProvider = ref.get(LocalStorageProvider);
      const provider = svc.getProvider();
      expect(provider).toBe(mockLocalProvider);
    });

    it('should resolve the default provider to S3 when STORAGE_TYPE=S3', async () => {
      const { unit: svc, unitRef: ref } = await TestBed.solitary(StorageService)
        .mock(ConfigService)
        .final({
          get: jest.fn().mockReturnValue(StorageType.S3),
        })
        .compile();

      const mockS3Provider = ref.get(S3StorageProvider);
      expect(svc.getProvider()).toBe(mockS3Provider);
      expect(svc.getDefaultStorageType()).toBe(StorageType.S3);
    });
  });

  describe('getDefaultStorageType', () => {
    it('defaults to LOCAL when STORAGE_TYPE is unset', () => {
      expect(service.getDefaultStorageType()).toBe(StorageType.LOCAL);
    });
  });

  describe('getProvider', () => {
    it('should return local storage provider for LOCAL type', () => {
      const provider = service.getProvider(StorageType.LOCAL);
      expect(provider).toBe(localProvider);
    });

    it('should return S3 storage provider for S3 type', () => {
      const provider = service.getProvider(StorageType.S3);
      expect(provider).toBe(s3Provider);
    });

    it('should throw error for AZURE_BLOB type (not implemented)', () => {
      expect(() => service.getProvider(StorageType.AZURE_BLOB)).toThrow(
        'Azure Blob storage provider not yet implemented',
      );
    });

    it('should fall back to LOCAL for unknown storage type', () => {
      const provider = service.getProvider('UNKNOWN' as StorageType);
      expect(provider).toBe(localProvider);
    });
  });

  describe('local-only convenience methods (hard-pinned, independent of STORAGE_TYPE)', () => {
    it('stays pinned to LocalStorageProvider even when the default type is S3', async () => {
      const { unit: svc, unitRef: ref } = await TestBed.solitary(StorageService)
        .mock(ConfigService)
        .final({
          get: jest.fn().mockReturnValue(StorageType.S3),
        })
        .compile();

      const mockLocalProvider = ref.get(LocalStorageProvider);
      const mockS3Provider = ref.get(S3StorageProvider);
      mockLocalProvider.fileExists.mockResolvedValue(true);

      const result = await svc.fileExists('/local/replay/segment.ts');

      expect(result).toBe(true);
      expect(mockLocalProvider.fileExists).toHaveBeenCalledWith(
        '/local/replay/segment.ts',
      );
      expect(mockS3Provider.fileExists).not.toHaveBeenCalled();
    });

    it('should delegate ensureDirectory to provider', async () => {
      localProvider.ensureDirectory.mockResolvedValue(undefined);
      await service.ensureDirectory('/test/path');
      expect(localProvider.ensureDirectory).toHaveBeenCalledWith('/test/path');
    });

    it('should delegate directoryExists to provider', async () => {
      localProvider.directoryExists.mockResolvedValue(true);
      const result = await service.directoryExists('/test/path');
      expect(result).toBe(true);
      expect(localProvider.directoryExists).toHaveBeenCalledWith('/test/path');
    });

    it('should delegate deleteDirectory to provider', async () => {
      localProvider.deleteDirectory.mockResolvedValue(undefined);
      await service.deleteDirectory('/test/path', {
        recursive: true,
        force: true,
      });
      expect(localProvider.deleteDirectory).toHaveBeenCalledWith('/test/path', {
        recursive: true,
        force: true,
      });
    });

    it('should delegate deleteFile to provider', async () => {
      localProvider.deleteFile.mockResolvedValue(undefined);
      await service.deleteFile('/test/file.txt');
      expect(localProvider.deleteFile).toHaveBeenCalledWith('/test/file.txt');
    });

    it('should delegate fileExists to provider', async () => {
      localProvider.fileExists.mockResolvedValue(false);
      const result = await service.fileExists('/test/missing.txt');
      expect(result).toBe(false);
      expect(localProvider.fileExists).toHaveBeenCalledWith(
        '/test/missing.txt',
      );
    });

    it('should delegate listFiles to provider', async () => {
      localProvider.listFiles.mockResolvedValue(['file1.ts', 'file2.ts']);
      const result = await service.listFiles('/test/dir');
      expect(result).toEqual(['file1.ts', 'file2.ts']);
      expect(localProvider.listFiles).toHaveBeenCalledWith(
        '/test/dir',
        undefined,
      );
    });

    it('should delegate listFiles with options to provider', async () => {
      const filterFn = (f: string) => f.endsWith('.ts');
      localProvider.listFiles.mockResolvedValue(['file1.ts']);
      await service.listFiles('/test/dir', { filter: filterFn });
      expect(localProvider.listFiles).toHaveBeenCalledWith('/test/dir', {
        filter: filterFn,
      });
    });

    it('should delegate getFileStats to provider', async () => {
      const stats = {
        size: 1024,
        mtime: new Date(),
        ctime: new Date(),
      };
      localProvider.getFileStats.mockResolvedValue(stats);
      const result = await service.getFileStats('/test/file.txt');
      expect(result).toEqual(stats);
      expect(localProvider.getFileStats).toHaveBeenCalledWith('/test/file.txt');
    });

    it('should delegate readFile to provider', async () => {
      const buffer = Buffer.from('test content');
      localProvider.readFile.mockResolvedValue(buffer);
      const result = await service.readFile('/test/file.txt');
      expect(result).toBe(buffer);
      expect(localProvider.readFile).toHaveBeenCalledWith('/test/file.txt');
    });

    it('should delegate writeFile to provider', async () => {
      localProvider.writeFile.mockResolvedValue(undefined);
      await service.writeFile('/test/file.txt', 'content');
      expect(localProvider.writeFile).toHaveBeenCalledWith(
        '/test/file.txt',
        'content',
      );
    });

    it('should delegate writeFile with Buffer to provider', async () => {
      const buffer = Buffer.from('binary content');
      localProvider.writeFile.mockResolvedValue(undefined);
      await service.writeFile('/test/file.bin', buffer);
      expect(localProvider.writeFile).toHaveBeenCalledWith(
        '/test/file.bin',
        buffer,
      );
    });

    it('should delegate deleteOldFiles to provider', async () => {
      localProvider.deleteOldFiles.mockResolvedValue(5);
      const cutoffDate = new Date();
      const result = await service.deleteOldFiles('/test/dir', cutoffDate);
      expect(result).toBe(5);
      expect(localProvider.deleteOldFiles).toHaveBeenCalledWith(
        '/test/dir',
        cutoffDate,
      );
    });

    it('should delegate createReadStream to provider', () => {
      const mockStream = {} as any;
      localProvider.createReadStream.mockReturnValue(mockStream);
      const result = service.createReadStream('/test/file.txt');
      expect(result).toBe(mockStream);
      expect(localProvider.createReadStream).toHaveBeenCalledWith(
        '/test/file.txt',
      );
    });

    it('should delegate getFileUrl to provider', async () => {
      localProvider.getFileUrl.mockResolvedValue('/test/file.txt');
      const result = await service.getFileUrl('/test/file.txt');
      expect(result).toBe('/test/file.txt');
      expect(localProvider.getFileUrl).toHaveBeenCalledWith('/test/file.txt');
    });
  });
});
