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
    const raw = this.configService.get<string>('THUMBNAIL_BACKFILL_ENABLED');
    if (raw === undefined) {
      return true;
    }
    const normalized = raw.trim().toLowerCase();
    return !['false', '0', 'off'].includes(normalized);
  }

  /**
   * Parses a non-negative integer env var, warning and falling back to
   * `defaultValue` when the value is missing, not a number, or (per
   * `allowZero`) not strictly positive.
   */
  private parseIntEnv(
    key: string,
    defaultValue: number,
    { allowZero }: { allowZero: boolean },
  ): number {
    const raw = this.configService.get<string>(key);
    if (raw === undefined) {
      return defaultValue;
    }

    const parsed = parseInt(raw, 10);
    const isValid = allowZero ? parsed >= 0 : parsed > 0;

    if (Number.isNaN(parsed) || !isValid) {
      this.logger.warn(
        `Invalid ${key} value "${raw}"; falling back to default ${defaultValue}`,
      );
      return defaultValue;
    }

    return parsed;
  }

  private getBatchSize(): number {
    return this.parseIntEnv('THUMBNAIL_BACKFILL_BATCH_SIZE', 25, {
      allowZero: false,
    });
  }

  private getStartupDelayMs(): number {
    return this.parseIntEnv('THUMBNAIL_BACKFILL_STARTUP_DELAY_MS', 60000, {
      allowZero: true,
    });
  }

  private getThrottleMs(): number {
    return this.parseIntEnv('THUMBNAIL_BACKFILL_THROTTLE_MS', 1000, {
      allowZero: true,
    });
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
      this.startupTimer = undefined;
      void this.backfill().catch((error) => {
        this.logger.error(
          `Thumbnail backfill failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, this.getStartupDelayMs());
    this.startupTimer.unref();
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

        if (throttleMs > 0) {
          await new Promise((resolve) => {
            const timer = setTimeout(resolve, throttleMs);
            timer.unref();
          });
        }
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
