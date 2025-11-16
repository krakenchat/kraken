import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService, StorageType } from './storage.service';
import { LocalStorageProvider } from './providers/local-storage.provider';

describe('StorageService', () => {
  let service: StorageService;
  let localProvider: LocalStorageProvider;

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockLocalStorageProvider = {
    ensureDirectory: jest.fn(),
    directoryExists: jest.fn(),
    deleteDirectory: jest.fn(),
    deleteFile: jest.fn(),
    fileExists: jest.fn(),
    listFiles: jest.fn(),
    getFileStats: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    deleteOldFiles: jest.fn(),
    createReadStream: jest.fn(),
    getFileUrl: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: LocalStorageProvider, useValue: mockLocalStorageProvider },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    localProvider = module.get<LocalStorageProvider>(LocalStorageProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialization', () => {
    it('should default to LOCAL storage type when not configured', () => {
      mockConfigService.get.mockReturnValue(undefined);
      const provider = service.getProvider();
      expect(provider).toBe(localProvider);
    });

    it('should use configured storage type from environment', async () => {
      mockConfigService.get.mockReturnValue(StorageType.LOCAL);

      const module = await Test.createTestingModule({
        providers: [
          StorageService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: LocalStorageProvider, useValue: mockLocalStorageProvider },
        ],
      }).compile();

      const svc = module.get<StorageService>(StorageService);
      const provider = svc.getProvider();
      expect(provider).toBe(mockLocalStorageProvider);
    });
  });

  describe('getProvider', () => {
    it('should return local storage provider for LOCAL type', () => {
      const provider = service.getProvider(StorageType.LOCAL);
      expect(provider).toBe(localProvider);
    });

    it('should throw error for S3 type (not implemented)', () => {
      expect(() => service.getProvider(StorageType.S3)).toThrow(
        'S3 storage provider not yet implemented',
      );
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

  describe('delegation methods', () => {
    it('should delegate ensureDirectory to provider', async () => {
      mockLocalStorageProvider.ensureDirectory.mockResolvedValue(undefined);
      await service.ensureDirectory('/test/path');
      expect(mockLocalStorageProvider.ensureDirectory).toHaveBeenCalledWith(
        '/test/path',
      );
    });

    it('should delegate directoryExists to provider', async () => {
      mockLocalStorageProvider.directoryExists.mockResolvedValue(true);
      const result = await service.directoryExists('/test/path');
      expect(result).toBe(true);
      expect(mockLocalStorageProvider.directoryExists).toHaveBeenCalledWith(
        '/test/path',
      );
    });

    it('should delegate deleteDirectory to provider', async () => {
      mockLocalStorageProvider.deleteDirectory.mockResolvedValue(undefined);
      await service.deleteDirectory('/test/path', {
        recursive: true,
        force: true,
      });
      expect(mockLocalStorageProvider.deleteDirectory).toHaveBeenCalledWith(
        '/test/path',
        { recursive: true, force: true },
      );
    });

    it('should delegate deleteFile to provider', async () => {
      mockLocalStorageProvider.deleteFile.mockResolvedValue(undefined);
      await service.deleteFile('/test/file.txt');
      expect(mockLocalStorageProvider.deleteFile).toHaveBeenCalledWith(
        '/test/file.txt',
      );
    });

    it('should delegate fileExists to provider', async () => {
      mockLocalStorageProvider.fileExists.mockResolvedValue(false);
      const result = await service.fileExists('/test/missing.txt');
      expect(result).toBe(false);
      expect(mockLocalStorageProvider.fileExists).toHaveBeenCalledWith(
        '/test/missing.txt',
      );
    });

    it('should delegate listFiles to provider', async () => {
      mockLocalStorageProvider.listFiles.mockResolvedValue([
        'file1.ts',
        'file2.ts',
      ]);
      const result = await service.listFiles('/test/dir');
      expect(result).toEqual(['file1.ts', 'file2.ts']);
      expect(mockLocalStorageProvider.listFiles).toHaveBeenCalledWith(
        '/test/dir',
        undefined,
      );
    });

    it('should delegate listFiles with options to provider', async () => {
      const filterFn = (f: string) => f.endsWith('.ts');
      mockLocalStorageProvider.listFiles.mockResolvedValue(['file1.ts']);
      await service.listFiles('/test/dir', { filter: filterFn });
      expect(mockLocalStorageProvider.listFiles).toHaveBeenCalledWith(
        '/test/dir',
        { filter: filterFn },
      );
    });

    it('should delegate getFileStats to provider', async () => {
      const stats = {
        size: 1024,
        mtime: new Date(),
        ctime: new Date(),
      };
      mockLocalStorageProvider.getFileStats.mockResolvedValue(stats);
      const result = await service.getFileStats('/test/file.txt');
      expect(result).toEqual(stats);
      expect(mockLocalStorageProvider.getFileStats).toHaveBeenCalledWith(
        '/test/file.txt',
      );
    });

    it('should delegate readFile to provider', async () => {
      const buffer = Buffer.from('test content');
      mockLocalStorageProvider.readFile.mockResolvedValue(buffer);
      const result = await service.readFile('/test/file.txt');
      expect(result).toBe(buffer);
      expect(mockLocalStorageProvider.readFile).toHaveBeenCalledWith(
        '/test/file.txt',
      );
    });

    it('should delegate writeFile to provider', async () => {
      mockLocalStorageProvider.writeFile.mockResolvedValue(undefined);
      await service.writeFile('/test/file.txt', 'content');
      expect(mockLocalStorageProvider.writeFile).toHaveBeenCalledWith(
        '/test/file.txt',
        'content',
      );
    });

    it('should delegate writeFile with Buffer to provider', async () => {
      const buffer = Buffer.from('binary content');
      mockLocalStorageProvider.writeFile.mockResolvedValue(undefined);
      await service.writeFile('/test/file.bin', buffer);
      expect(mockLocalStorageProvider.writeFile).toHaveBeenCalledWith(
        '/test/file.bin',
        buffer,
      );
    });

    it('should delegate deleteOldFiles to provider', async () => {
      mockLocalStorageProvider.deleteOldFiles.mockResolvedValue(5);
      const cutoffDate = new Date();
      const result = await service.deleteOldFiles('/test/dir', cutoffDate);
      expect(result).toBe(5);
      expect(mockLocalStorageProvider.deleteOldFiles).toHaveBeenCalledWith(
        '/test/dir',
        cutoffDate,
      );
    });

    it('should delegate createReadStream to provider', () => {
      const mockStream = {} as any;
      mockLocalStorageProvider.createReadStream.mockReturnValue(mockStream);
      const result = service.createReadStream('/test/file.txt');
      expect(result).toBe(mockStream);
      expect(mockLocalStorageProvider.createReadStream).toHaveBeenCalledWith(
        '/test/file.txt',
      );
    });

    it('should delegate getFileUrl to provider', async () => {
      mockLocalStorageProvider.getFileUrl.mockResolvedValue('/test/file.txt');
      const result = await service.getFileUrl('/test/file.txt');
      expect(result).toBe('/test/file.txt');
      expect(mockLocalStorageProvider.getFileUrl).toHaveBeenCalledWith(
        '/test/file.txt',
      );
    });
  });
});
