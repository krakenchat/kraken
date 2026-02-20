import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import { StorageService } from '@/storage/storage.service';
import { FfmpegProvider } from '@/livekit/providers/ffmpeg.provider';

@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);
  private readonly uploadsDir: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
    private readonly ffmpegProvider: FfmpegProvider,
  ) {
    this.uploadsDir =
      this.configService.get<string>('FILE_UPLOAD_DEST') || './uploads';
  }

  /**
   * Generate a JPEG thumbnail from a video file using FFmpeg.
   * Extracts a single frame at ~1 second, scaled to 480px wide.
   *
   * @param filePath - Absolute path to the uploaded video file
   * @param fileId - Database file ID (used for naming the thumbnail)
   * @returns The thumbnail path on success, or null on failure (non-fatal)
   */
  async generateVideoThumbnail(
    filePath: string,
    fileId: string,
  ): Promise<string | null> {
    const thumbnailDir = path.join(this.uploadsDir, 'thumbnails');
    const thumbnailPath = path.join(thumbnailDir, `${fileId}.jpg`);

    try {
      await this.storageService.ensureDirectory(thumbnailDir);

      await this.runThumbnailExtraction(filePath, thumbnailPath);

      this.logger.log(`Generated thumbnail for file ${fileId}`);
      return thumbnailPath;
    } catch (error) {
      this.logger.warn(
        `Failed to generate thumbnail for file ${fileId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private runThumbnailExtraction(
    inputPath: string,
    outputPath: string,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const command = this.ffmpegProvider
        .createCommand()
        .input(inputPath)
        .inputOptions('-ss', '1') // Seek to 1 second (fast, before decoding)
        .outputOptions(
          '-vframes',
          '1', // Extract single frame
          '-vf',
          'scale=480:-1', // Scale to 480px wide, preserve aspect ratio
          '-f',
          'image2', // Output as image
          '-q:v',
          '5', // JPEG quality (2=best, 31=worst)
        )
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => {
          reject(
            new Error(
              `FFmpeg thumbnail extraction failed: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
        });

      // Timeout: 30 seconds should be more than enough for a single frame
      const timeout = setTimeout(() => {
        command.kill('SIGKILL');
        reject(new Error('Thumbnail generation timed out after 30 seconds'));
      }, 30_000);

      command.on('end', () => clearTimeout(timeout));
      command.on('error', () => clearTimeout(timeout));

      command.run();
    });
  }
}
