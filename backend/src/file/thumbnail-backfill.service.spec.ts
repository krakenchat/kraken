import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { ConfigService } from '@nestjs/config';
import { ThumbnailBackfillService } from './thumbnail-backfill.service';
import { DatabaseService } from '@/database/database.service';
import { StorageService } from '@/storage/storage.service';
import { ThumbnailService } from './thumbnail.service';
import { FileType, StorageType } from '@prisma/client';
import type { IStorageProvider } from '@/storage/interfaces/storage-provider.interface';
import { Readable } from 'stream';

// The S3 download-to-tmp branch pipes a real fs write stream; mocking just
// createWriteStream/rm/pipeline keeps the S3 backfill tests fast/deterministic
// and avoids interaction between jest fake timers (used throughout this
// suite for the throttle sleep) and real filesystem I/O completion
// callbacks. Everything else in 'fs' passes through unmocked — Prisma's
// generated client uses fs.existsSync internally at import time.
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    ...jest.requireActual('fs').promises,
    rm: jest.fn().mockResolvedValue(undefined),
  },
  createWriteStream: jest.fn(() => ({})),
}));
jest.mock('stream/promises', () => ({
  ...jest.requireActual('stream/promises'),
  pipeline: jest.fn().mockResolvedValue(undefined),
}));

describe('ThumbnailBackfillService', () => {
  let service: ThumbnailBackfillService;
  let databaseService: Mocked<DatabaseService>;
  let storageService: Mocked<StorageService>;
  let thumbnailService: Mocked<ThumbnailService>;
  let configService: Mocked<ConfigService>;
  let mockProvider: jest.Mocked<IStorageProvider>;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(
      ThumbnailBackfillService,
    ).compile();

    service = unit;
    databaseService = unitRef.get(DatabaseService);
    storageService = unitRef.get(StorageService);
    thumbnailService = unitRef.get(ThumbnailService);
    configService = unitRef.get(ConfigService);

    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default: no env vars set, so the service falls back to its defaults
    // (enabled, batch size 25, 60s startup delay, 1s throttle).
    configService.get.mockReturnValue(undefined);

    // Per-record provider resolution: backfill() always calls
    // storageService.getProvider(file.storageType) and operates on the
    // returned provider directly (never the ambient/local-only wrappers).
    mockProvider = {
      writeStream: jest.fn(),
      getReadStream: jest.fn(),
      deleteFile: jest.fn(),
      fileExists: jest.fn(),
      getFileStats: jest.fn(),
      getFileUrl: jest.fn(),
    };
    storageService.getProvider.mockReturnValue(mockProvider);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('onApplicationBootstrap', () => {
    it('should log and never call backfill when disabled via THUMBNAIL_BACKFILL_ENABLED', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'THUMBNAIL_BACKFILL_ENABLED' ? 'false' : undefined,
      );
      const logSpy = jest
        .spyOn(
          (service as unknown as { logger: { log: (msg: string) => void } })
            .logger,
          'log',
        )
        .mockImplementation(() => undefined);

      service.onApplicationBootstrap();
      await jest.runAllTimersAsync();

      expect(logSpy).toHaveBeenCalledWith(
        'Thumbnail backfill disabled via THUMBNAIL_BACKFILL_ENABLED',
      );
      expect(databaseService.file.findMany).not.toHaveBeenCalled();
    });

    it('should defer backfill behind THUMBNAIL_BACKFILL_STARTUP_DELAY_MS', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'THUMBNAIL_BACKFILL_STARTUP_DELAY_MS' ? '5000' : undefined,
      );
      databaseService.file.findMany.mockResolvedValue([]);

      service.onApplicationBootstrap();
      expect(databaseService.file.findMany).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(4999);
      expect(databaseService.file.findMany).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);
      expect(databaseService.file.findMany).toHaveBeenCalledTimes(1);
    });

    it('should clear the pending startup timer on onModuleDestroy', async () => {
      databaseService.file.findMany.mockResolvedValue([]);

      service.onApplicationBootstrap();
      service.onModuleDestroy();

      await jest.advanceTimersByTimeAsync(60_000);

      expect(databaseService.file.findMany).not.toHaveBeenCalled();
    });

    it('should not reject when the deferred backfill fails', async () => {
      databaseService.file.findMany.mockRejectedValue(new Error('db down'));

      expect(() => service.onApplicationBootstrap()).not.toThrow();
      await jest.advanceTimersByTimeAsync(60_000);
    });

    it.each(['FALSE', '0', 'off', 'OFF', '  false  '])(
      'should treat THUMBNAIL_BACKFILL_ENABLED=%s as disabled (case-insensitive, trimmed)',
      async (value) => {
        configService.get.mockImplementation((key: string) =>
          key === 'THUMBNAIL_BACKFILL_ENABLED' ? value : undefined,
        );
        const logSpy = jest
          .spyOn(
            (service as unknown as { logger: { log: (msg: string) => void } })
              .logger,
            'log',
          )
          .mockImplementation(() => undefined);

        service.onApplicationBootstrap();
        await jest.runAllTimersAsync();

        expect(logSpy).toHaveBeenCalledWith(
          'Thumbnail backfill disabled via THUMBNAIL_BACKFILL_ENABLED',
        );
        expect(databaseService.file.findMany).not.toHaveBeenCalled();
      },
    );

    it('should treat unrecognized THUMBNAIL_BACKFILL_ENABLED values as enabled', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'THUMBNAIL_BACKFILL_ENABLED' ? 'yes' : undefined,
      );
      databaseService.file.findMany.mockResolvedValue([]);

      service.onApplicationBootstrap();
      await jest.runAllTimersAsync();

      expect(databaseService.file.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('backfill', () => {
    it('should query only non-deleted video files without a thumbnail, cursored on id', async () => {
      databaseService.file.findMany.mockResolvedValue([]);

      await service.backfill();

      expect(databaseService.file.findMany).toHaveBeenCalledWith({
        where: {
          fileType: FileType.VIDEO,
          thumbnailPath: null,
          deletedAt: null,
        },
        orderBy: { id: 'asc' },
        take: 25,
        select: { id: true, storagePath: true, storageType: true },
      });
    });

    it('should do nothing when no files need backfill', async () => {
      databaseService.file.findMany.mockResolvedValue([]);

      const result = await service.backfill();

      expect(result).toEqual({ generated: 0, skipped: 0 });
      expect(thumbnailService.generateVideoThumbnail).not.toHaveBeenCalled();
    });

    it('should page through candidates with an id cursor until a short batch is returned', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'THUMBNAIL_BACKFILL_BATCH_SIZE' ? '2' : undefined,
      );
      databaseService.file.findMany
        .mockResolvedValueOnce([
          {
            id: 'file-a',
            storagePath: '/clips/a.mp4',
            storageType: StorageType.LOCAL,
          },
          {
            id: 'file-b',
            storagePath: '/clips/b.mp4',
            storageType: StorageType.LOCAL,
          },
        ] as any)
        .mockResolvedValueOnce([
          {
            id: 'file-c',
            storagePath: '/clips/c.mp4',
            storageType: StorageType.LOCAL,
          },
        ] as any);
      mockProvider.fileExists.mockResolvedValue(true);
      thumbnailService.generateVideoThumbnail
        .mockResolvedValueOnce('thumb-a.jpg')
        .mockResolvedValueOnce('thumb-b.jpg')
        .mockResolvedValueOnce('thumb-c.jpg');
      databaseService.file.update.mockResolvedValue({} as any);

      const resultPromise = service.backfill();
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toEqual({ generated: 3, skipped: 0 });
      expect(databaseService.file.findMany).toHaveBeenCalledTimes(2);
      expect(databaseService.file.findMany).toHaveBeenNthCalledWith(1, {
        where: {
          fileType: FileType.VIDEO,
          thumbnailPath: null,
          deletedAt: null,
        },
        orderBy: { id: 'asc' },
        take: 2,
        select: { id: true, storagePath: true, storageType: true },
      });
      expect(databaseService.file.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          fileType: FileType.VIDEO,
          thumbnailPath: null,
          deletedAt: null,
          id: { gt: 'file-b' },
        },
        orderBy: { id: 'asc' },
        take: 2,
        select: { id: true, storagePath: true, storageType: true },
      });
      expect(thumbnailService.generateVideoThumbnail).toHaveBeenCalledTimes(3);
    });

    it.each([
      ['THUMBNAIL_BACKFILL_BATCH_SIZE', 'not-a-number', 25],
      ['THUMBNAIL_BACKFILL_BATCH_SIZE', '0', 25],
      ['THUMBNAIL_BACKFILL_BATCH_SIZE', '-5', 25],
    ])(
      'should fall back to the default batch size and warn when %s=%s is invalid',
      async (key, value, expectedDefault) => {
        configService.get.mockImplementation((k: string) =>
          k === key ? value : undefined,
        );
        const warnSpy = jest
          .spyOn(
            (
              service as unknown as {
                logger: { warn: (msg: string) => void };
              }
            ).logger,
            'warn',
          )
          .mockImplementation(() => undefined);
        databaseService.file.findMany.mockResolvedValue([]);

        await service.backfill();

        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            `Invalid ${key} value "${value}"; falling back to default ${expectedDefault}`,
          ),
        );
        expect(databaseService.file.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ take: expectedDefault }),
        );
      },
    );

    it.each([
      ['THUMBNAIL_BACKFILL_THROTTLE_MS', 'not-a-number'],
      ['THUMBNAIL_BACKFILL_THROTTLE_MS', '-1'],
    ])('should fall back to the default for %s=%s', async (key, value) => {
      configService.get.mockImplementation((k: string) =>
        k === key ? value : undefined,
      );
      const warnSpy = jest
        .spyOn(
          (
            service as unknown as {
              logger: { warn: (msg: string) => void };
            }
          ).logger,
          'warn',
        )
        .mockImplementation(() => undefined);
      databaseService.file.findMany.mockResolvedValue([]);

      await service.backfill();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Invalid ${key} value "${value}"`),
      );
    });

    it.each([
      ['THUMBNAIL_BACKFILL_STARTUP_DELAY_MS', 'not-a-number'],
      ['THUMBNAIL_BACKFILL_STARTUP_DELAY_MS', '-1'],
    ])(
      'should fall back to the default startup delay (60s) and warn for %s=%s',
      async (key, value) => {
        configService.get.mockImplementation((k: string) =>
          k === key ? value : undefined,
        );
        const warnSpy = jest
          .spyOn(
            (
              service as unknown as {
                logger: { warn: (msg: string) => void };
              }
            ).logger,
            'warn',
          )
          .mockImplementation(() => undefined);
        databaseService.file.findMany.mockResolvedValue([]);

        service.onApplicationBootstrap();

        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining(`Invalid ${key} value "${value}"`),
        );
        expect(databaseService.file.findMany).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(60_000);
        expect(databaseService.file.findMany).toHaveBeenCalledTimes(1);
      },
    );

    it('should skip the throttle sleep entirely when THUMBNAIL_BACKFILL_THROTTLE_MS is 0', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'THUMBNAIL_BACKFILL_THROTTLE_MS' ? '0' : undefined,
      );
      databaseService.file.findMany
        .mockResolvedValueOnce([
          {
            id: 'file-1',
            storagePath: '/clips/a.mp4',
            storageType: StorageType.LOCAL,
          },
          {
            id: 'file-2',
            storagePath: '/clips/b.mp4',
            storageType: StorageType.LOCAL,
          },
        ] as any)
        .mockResolvedValueOnce([]);
      mockProvider.fileExists.mockResolvedValue(true);
      thumbnailService.generateVideoThumbnail
        .mockResolvedValueOnce('thumb-1.jpg')
        .mockResolvedValueOnce('thumb-2.jpg');
      databaseService.file.update.mockResolvedValue({} as any);

      // No fake-timer advancement needed: with throttle 0 there is no
      // setTimeout gating between files, so the promise settles on its own.
      const result = await service.backfill();

      expect(result).toEqual({ generated: 2, skipped: 0 });
      expect(thumbnailService.generateVideoThumbnail).toHaveBeenCalledTimes(2);
    });

    it('should sleep THUMBNAIL_BACKFILL_THROTTLE_MS between files', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'THUMBNAIL_BACKFILL_THROTTLE_MS' ? '1000' : undefined,
      );
      databaseService.file.findMany
        .mockResolvedValueOnce([
          {
            id: 'file-1',
            storagePath: '/clips/a.mp4',
            storageType: StorageType.LOCAL,
          },
          {
            id: 'file-2',
            storagePath: '/clips/b.mp4',
            storageType: StorageType.LOCAL,
          },
        ] as any)
        .mockResolvedValueOnce([]);
      mockProvider.fileExists.mockResolvedValue(true);
      thumbnailService.generateVideoThumbnail
        .mockResolvedValueOnce('thumb-1.jpg')
        .mockResolvedValueOnce('thumb-2.jpg');
      databaseService.file.update.mockResolvedValue({} as any);

      const resultPromise = service.backfill();

      // Let the first file's async work settle before the throttle sleep gates
      // the second one.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(thumbnailService.generateVideoThumbnail).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(999);
      expect(thumbnailService.generateVideoThumbnail).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);
      expect(thumbnailService.generateVideoThumbnail).toHaveBeenCalledTimes(2);

      // Flush the trailing throttle sleep after the last file so the
      // backfill promise settles.
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toEqual({ generated: 2, skipped: 0 });
    });

    it('should generate thumbnails and persist paths for backfillable files', async () => {
      databaseService.file.findMany
        .mockResolvedValueOnce([
          {
            id: 'file-1',
            storagePath: '/clips/a.mp4',
            storageType: StorageType.LOCAL,
          },
          {
            id: 'file-2',
            storagePath: '/clips/b.mp4',
            storageType: StorageType.LOCAL,
          },
        ] as any)
        .mockResolvedValueOnce([]);
      mockProvider.fileExists.mockResolvedValue(true);
      thumbnailService.generateVideoThumbnail
        .mockResolvedValueOnce('uploads/thumbnails/file-1.jpg')
        .mockResolvedValueOnce('uploads/thumbnails/file-2.jpg');
      databaseService.file.update.mockResolvedValue({} as any);

      const resultPromise = service.backfill();
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toEqual({ generated: 2, skipped: 0 });
      expect(databaseService.file.update).toHaveBeenCalledWith({
        where: { id: 'file-1' },
        data: { thumbnailPath: 'uploads/thumbnails/file-1.jpg' },
      });
      expect(databaseService.file.update).toHaveBeenCalledWith({
        where: { id: 'file-2' },
        data: { thumbnailPath: 'uploads/thumbnails/file-2.jpg' },
      });
    });

    it('should skip files whose source no longer exists on disk', async () => {
      databaseService.file.findMany
        .mockResolvedValueOnce([
          {
            id: 'file-gone',
            storagePath: '/clips/gone.mp4',
            storageType: StorageType.LOCAL,
          },
        ] as any)
        .mockResolvedValueOnce([]);
      mockProvider.fileExists.mockResolvedValue(false);

      const resultPromise = service.backfill();
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toEqual({ generated: 0, skipped: 1 });
      expect(thumbnailService.generateVideoThumbnail).not.toHaveBeenCalled();
      expect(databaseService.file.update).not.toHaveBeenCalled();
    });

    it('should skip files whose generation fails and continue with the rest', async () => {
      databaseService.file.findMany
        .mockResolvedValueOnce([
          {
            id: 'file-bad',
            storagePath: '/clips/bad.mp4',
            storageType: StorageType.LOCAL,
          },
          {
            id: 'file-good',
            storagePath: '/clips/good.mp4',
            storageType: StorageType.LOCAL,
          },
        ] as any)
        .mockResolvedValueOnce([]);
      mockProvider.fileExists.mockResolvedValue(true);
      thumbnailService.generateVideoThumbnail
        .mockResolvedValueOnce(null) // generateVideoThumbnail returns null on failure
        .mockResolvedValueOnce('uploads/thumbnails/file-good.jpg');
      databaseService.file.update.mockResolvedValue({} as any);

      const resultPromise = service.backfill();
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toEqual({ generated: 1, skipped: 1 });
      expect(databaseService.file.update).toHaveBeenCalledTimes(1);
      expect(databaseService.file.update).toHaveBeenCalledWith({
        where: { id: 'file-good' },
        data: { thumbnailPath: 'uploads/thumbnails/file-good.jpg' },
      });
    });

    it('should continue with remaining files when one file errors mid-processing', async () => {
      databaseService.file.findMany
        .mockResolvedValueOnce([
          {
            id: 'file-db-err',
            storagePath: '/clips/a.mp4',
            storageType: StorageType.LOCAL,
          },
          {
            id: 'file-ok',
            storagePath: '/clips/b.mp4',
            storageType: StorageType.LOCAL,
          },
        ] as any)
        .mockResolvedValueOnce([]);
      mockProvider.fileExists.mockResolvedValue(true);
      thumbnailService.generateVideoThumbnail
        .mockResolvedValueOnce('uploads/thumbnails/file-db-err.jpg')
        .mockResolvedValueOnce('uploads/thumbnails/file-ok.jpg');
      databaseService.file.update
        .mockRejectedValueOnce(new Error('transient db error'))
        .mockResolvedValueOnce({} as any);

      const resultPromise = service.backfill();
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toEqual({ generated: 1, skipped: 1 });
      expect(databaseService.file.update).toHaveBeenCalledWith({
        where: { id: 'file-ok' },
        data: { thumbnailPath: 'uploads/thumbnails/file-ok.jpg' },
      });
    });

    describe('per-record provider resolution (mixed LOCAL/S3 instances)', () => {
      it('resolves the LOCAL provider for a LOCAL-storageType file and feeds ffmpeg directly', async () => {
        databaseService.file.findMany
          .mockResolvedValueOnce([
            {
              id: 'file-local',
              storagePath: '/clips/local.mp4',
              storageType: StorageType.LOCAL,
            },
          ] as any)
          .mockResolvedValueOnce([]);
        mockProvider.fileExists.mockResolvedValue(true);
        thumbnailService.generateVideoThumbnail.mockResolvedValue(
          'uploads/thumbnails/file-local.jpg',
        );
        databaseService.file.update.mockResolvedValue({} as any);

        const resultPromise = service.backfill();
        await jest.runAllTimersAsync();
        const result = await resultPromise;

        expect(result).toEqual({ generated: 1, skipped: 0 });
        expect(storageService.getProvider).toHaveBeenCalledWith(
          StorageType.LOCAL,
        );
        // LOCAL source: ffmpeg reads the storagePath directly, no download step.
        expect(thumbnailService.generateVideoThumbnail).toHaveBeenCalledWith(
          '/clips/local.mp4',
          'file-local',
          StorageType.LOCAL,
        );
        expect(mockProvider.getReadStream).not.toHaveBeenCalled();
      });

      it('downloads an S3-storageType file to a local tmp path before generating, then cleans it up', async () => {
        databaseService.file.findMany
          .mockResolvedValueOnce([
            {
              id: 'file-s3',
              storagePath: 's3-object-key.mp4',
              storageType: StorageType.S3,
            },
          ] as any)
          .mockResolvedValueOnce([]);
        mockProvider.fileExists.mockResolvedValue(true);
        mockProvider.getReadStream.mockResolvedValue(
          Readable.from([Buffer.from('fake video bytes')]),
        );

        let capturedTmpPath: string | undefined;
        thumbnailService.generateVideoThumbnail.mockImplementation(
          (filePath: string) => {
            capturedTmpPath = filePath;
            return Promise.resolve('thumbnails/file-s3.jpg');
          },
        );
        databaseService.file.update.mockResolvedValue({} as any);

        const resultPromise = service.backfill();
        await jest.runAllTimersAsync();
        const result = await resultPromise;

        expect(result).toEqual({ generated: 1, skipped: 0 });
        expect(storageService.getProvider).toHaveBeenCalledWith(StorageType.S3);
        expect(mockProvider.getReadStream).toHaveBeenCalledWith(
          's3-object-key.mp4',
        );
        // ffmpeg was fed a LOCAL scratch path, not the S3 key.
        expect(capturedTmpPath).toBeDefined();
        expect(capturedTmpPath).not.toBe('s3-object-key.mp4');
        expect(thumbnailService.generateVideoThumbnail).toHaveBeenCalledWith(
          capturedTmpPath,
          'file-s3',
          StorageType.S3,
        );
        expect(databaseService.file.update).toHaveBeenCalledWith({
          where: { id: 'file-s3' },
          data: { thumbnailPath: 'thumbnails/file-s3.jpg' },
        });
      });

      it('still cleans up the local tmp download when thumbnail generation fails for an S3 file', async () => {
        databaseService.file.findMany
          .mockResolvedValueOnce([
            {
              id: 'file-s3-fail',
              storagePath: 's3-object-key.mp4',
              storageType: StorageType.S3,
            },
          ] as any)
          .mockResolvedValueOnce([]);
        mockProvider.fileExists.mockResolvedValue(true);
        mockProvider.getReadStream.mockResolvedValue(
          Readable.from([Buffer.from('fake video bytes')]),
        );
        thumbnailService.generateVideoThumbnail.mockResolvedValue(null);

        const resultPromise = service.backfill();
        await jest.runAllTimersAsync();
        const result = await resultPromise;

        expect(result).toEqual({ generated: 0, skipped: 1 });
        expect(databaseService.file.update).not.toHaveBeenCalled();
      });
    });
  });
});
