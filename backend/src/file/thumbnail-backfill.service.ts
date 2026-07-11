import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
 *
 * Startup is deferred (THUMBNAIL_BACKFILL_STARTUP_DELAY_MS) and candidates
 * are fetched in batches via an id cursor (THUMBNAIL_BACKFILL_BATCH_SIZE)
 * rather than all at once, so a large backlog can't spike memory or
 * saturate the DB working set at boot. See GitHub issue #409.
 */
@Injectable()
export class ThumbnailBackfillService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ThumbnailBackfillService.name);
  private startupTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    private readonly thumbnailService: ThumbnailService,
    private readonly configService: ConfigService,
  ) {}

  private isEnabled(): boolean {
    return (
      this.configService.get<string>('THUMBNAIL_BACKFILL_ENABLED') !== 'false'
    );
  }

  private getBatchSize(): number {
    return parseInt(
      this.configService.get<string>('THUMBNAIL_BACKFILL_BATCH_SIZE') || '25',
      10,
    );
  }

  private getStartupDelayMs(): number {
    return parseInt(
      this.configService.get<string>('THUMBNAIL_BACKFILL_STARTUP_DELAY_MS') ||
        '60000',
      10,
    );
  }

  private getThrottleMs(): number {
    return parseInt(
      this.configService.get<string>('THUMBNAIL_BACKFILL_THROTTLE_MS') ||
        '1000',
      10,
    );
  }

  onApplicationBootstrap(): void {
    if (!this.isEnabled()) {
      this.logger.log(
        'Thumbnail backfill disabled via THUMBNAIL_BACKFILL_ENABLED',
      );
      return;
    }

    // Defer past peak startup memory, then fire-and-forget so we never
    // block application startup.
    this.startupTimer = setTimeout(() => {
      void this.backfill().catch((error) => {
        this.logger.error(
          `Thumbnail backfill failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, this.getStartupDelayMs());
  }

  onModuleDestroy(): void {
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = undefined;
    }
  }

  async backfill(): Promise<{ generated: number; skipped: number }> {
    const batchSize = this.getBatchSize();
    const throttleMs = this.getThrottleMs();

    let generated = 0;
    let skipped = 0;
    let processed = 0;
    let lastId: string | undefined;

    for (;;) {
      const batch = await this.databaseService.file.findMany({
        where: {
          fileType: FileType.VIDEO,
          thumbnailPath: null,
          deletedAt: null,
          ...(lastId ? { id: { gt: lastId } } : {}),
        },
        orderBy: { id: 'asc' },
        take: batchSize,
        select: { id: true, storagePath: true },
      });

      if (batch.length === 0) {
        break;
      }

      if (processed === 0) {
        this.logger.log(
          `Backfilling thumbnails for video files without one (batch size ${batchSize})`,
        );
      }

      // Sequential on purpose: avoids spawning concurrent ffmpeg processes.
      // Best-effort per file: one failure must not abort the remaining candidates.
      for (const file of batch) {
        try {
          if (!(await this.storageService.fileExists(file.storagePath))) {
            this.logger.warn(
              `Skipping thumbnail backfill for file ${file.id}: source ${file.storagePath} not found`,
            );
            skipped++;
            continue;
          }

          // generateVideoThumbnail logs and returns null on failure
          const thumbnailPath =
            await this.thumbnailService.generateVideoThumbnail(
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
        } catch (error) {
          this.logger.warn(
            `Skipping thumbnail backfill for file ${file.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
          skipped++;
        } finally {
          processed++;
          lastId = file.id;
        }

        await new Promise((resolve) => setTimeout(resolve, throttleMs));
      }

      if (batch.length < batchSize) {
        break;
      }
    }

    if (processed > 0) {
      this.logger.log(
        `Thumbnail backfill complete: ${generated} generated, ${skipped} skipped`,
      );
    }

    return { generated, skipped };
  }
}
