import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { FileType } from '@prisma/client';
import { DatabaseService } from '@/database/database.service';
import { StorageService } from '@/storage/storage.service';
import { ThumbnailService } from './thumbnail.service';

/**
 * Backfills missing video thumbnails on startup.
 *
 * Video files uploaded before thumbnail support existed — or whose
 * generation failed at upload/capture time — have a null thumbnailPath
 * forever, since generation only ever ran once. This service retries
 * them on boot so old replay clips and video attachments get thumbnails
 * retroactively. Files whose source is gone or whose generation keeps
 * failing are skipped (and retried on the next boot, which is cheap:
 * one ffmpeg frame-extraction per file, run sequentially).
 */
@Injectable()
export class ThumbnailBackfillService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ThumbnailBackfillService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    private readonly thumbnailService: ThumbnailService,
  ) {}

  onApplicationBootstrap(): void {
    // Fire-and-forget: never block application startup
    void this.backfill().catch((error) => {
      this.logger.error(
        `Thumbnail backfill failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  async backfill(): Promise<{ generated: number; skipped: number }> {
    const candidates = await this.databaseService.file.findMany({
      where: {
        fileType: FileType.VIDEO,
        thumbnailPath: null,
        deletedAt: null,
      },
      select: { id: true, storagePath: true },
    });

    if (candidates.length === 0) {
      return { generated: 0, skipped: 0 };
    }

    this.logger.log(
      `Backfilling thumbnails for ${candidates.length} video file(s) without one`,
    );

    let generated = 0;
    let skipped = 0;

    // Sequential on purpose: avoids spawning concurrent ffmpeg processes
    for (const file of candidates) {
      if (!(await this.storageService.fileExists(file.storagePath))) {
        this.logger.warn(
          `Skipping thumbnail backfill for file ${file.id}: source ${file.storagePath} not found`,
        );
        skipped++;
        continue;
      }

      // generateVideoThumbnail logs and returns null on failure
      const thumbnailPath = await this.thumbnailService.generateVideoThumbnail(
        file.storagePath,
        file.id,
      );

      if (!thumbnailPath) {
        skipped++;
        continue;
      }

      await this.databaseService.file.update({
        where: { id: file.id },
        data: { thumbnailPath },
      });
      generated++;
    }

    this.logger.log(
      `Thumbnail backfill complete: ${generated} generated, ${skipped} skipped`,
    );
    return { generated, skipped };
  }
}
