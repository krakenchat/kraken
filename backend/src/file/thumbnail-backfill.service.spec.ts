import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { ThumbnailBackfillService } from './thumbnail-backfill.service';
import { DatabaseService } from '@/database/database.service';
import { StorageService } from '@/storage/storage.service';
import { ThumbnailService } from './thumbnail.service';
import { FileType } from '@prisma/client';

describe('ThumbnailBackfillService', () => {
  let service: ThumbnailBackfillService;
  let databaseService: Mocked<DatabaseService>;
  let storageService: Mocked<StorageService>;
  let thumbnailService: Mocked<ThumbnailService>;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(
      ThumbnailBackfillService,
    ).compile();

    service = unit;
    databaseService = unitRef.get(DatabaseService);
    storageService = unitRef.get(StorageService);
    thumbnailService = unitRef.get(ThumbnailService);

    jest.clearAllMocks();
  });

  it('should query only non-deleted video files without a thumbnail', async () => {
    databaseService.file.findMany.mockResolvedValue([]);

    await service.backfill();

    expect(databaseService.file.findMany).toHaveBeenCalledWith({
      where: {
        fileType: FileType.VIDEO,
        thumbnailPath: null,
        deletedAt: null,
      },
      select: { id: true, storagePath: true },
    });
  });

  it('should do nothing when no files need backfill', async () => {
    databaseService.file.findMany.mockResolvedValue([]);

    const result = await service.backfill();

    expect(result).toEqual({ generated: 0, skipped: 0 });
    expect(thumbnailService.generateVideoThumbnail).not.toHaveBeenCalled();
  });

  it('should generate thumbnails and persist paths for backfillable files', async () => {
    databaseService.file.findMany.mockResolvedValue([
      { id: 'file-1', storagePath: '/clips/a.mp4' },
      { id: 'file-2', storagePath: '/clips/b.mp4' },
    ] as any);
    storageService.fileExists.mockResolvedValue(true);
    thumbnailService.generateVideoThumbnail
      .mockResolvedValueOnce('uploads/thumbnails/file-1.jpg')
      .mockResolvedValueOnce('uploads/thumbnails/file-2.jpg');
    databaseService.file.update.mockResolvedValue({} as any);

    const result = await service.backfill();

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
    databaseService.file.findMany.mockResolvedValue([
      { id: 'file-gone', storagePath: '/clips/gone.mp4' },
    ] as any);
    storageService.fileExists.mockResolvedValue(false);

    const result = await service.backfill();

    expect(result).toEqual({ generated: 0, skipped: 1 });
    expect(thumbnailService.generateVideoThumbnail).not.toHaveBeenCalled();
    expect(databaseService.file.update).not.toHaveBeenCalled();
  });

  it('should skip files whose generation fails and continue with the rest', async () => {
    databaseService.file.findMany.mockResolvedValue([
      { id: 'file-bad', storagePath: '/clips/bad.mp4' },
      { id: 'file-good', storagePath: '/clips/good.mp4' },
    ] as any);
    storageService.fileExists.mockResolvedValue(true);
    thumbnailService.generateVideoThumbnail
      .mockResolvedValueOnce(null) // generateVideoThumbnail returns null on failure
      .mockResolvedValueOnce('uploads/thumbnails/file-good.jpg');
    databaseService.file.update.mockResolvedValue({} as any);

    const result = await service.backfill();

    expect(result).toEqual({ generated: 1, skipped: 1 });
    expect(databaseService.file.update).toHaveBeenCalledTimes(1);
    expect(databaseService.file.update).toHaveBeenCalledWith({
      where: { id: 'file-good' },
      data: { thumbnailPath: 'uploads/thumbnails/file-good.jpg' },
    });
  });

  it('should continue with remaining files when one file errors mid-processing', async () => {
    databaseService.file.findMany.mockResolvedValue([
      { id: 'file-db-err', storagePath: '/clips/a.mp4' },
      { id: 'file-ok', storagePath: '/clips/b.mp4' },
    ] as any);
    storageService.fileExists.mockResolvedValue(true);
    thumbnailService.generateVideoThumbnail
      .mockResolvedValueOnce('uploads/thumbnails/file-db-err.jpg')
      .mockResolvedValueOnce('uploads/thumbnails/file-ok.jpg');
    databaseService.file.update
      .mockRejectedValueOnce(new Error('transient db error'))
      .mockResolvedValueOnce({} as any);

    const result = await service.backfill();

    expect(result).toEqual({ generated: 1, skipped: 1 });
    expect(databaseService.file.update).toHaveBeenCalledWith({
      where: { id: 'file-ok' },
      data: { thumbnailPath: 'uploads/thumbnails/file-ok.jpg' },
    });
  });

  it('should not reject from onApplicationBootstrap when backfill fails', async () => {
    databaseService.file.findMany.mockRejectedValue(new Error('db down'));

    expect(() => service.onApplicationBootstrap()).not.toThrow();
    // Allow the fire-and-forget promise to settle (error is logged, not thrown)
    await new Promise((r) => setImmediate(r));
  });
});
