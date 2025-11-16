import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import {
  EgressClient,
  SegmentedFileOutput,
  SegmentedFileProtocol,
  EncodingOptionsPreset,
  EgressStatus,
} from 'livekit-server-sdk';
import { Prisma } from '@prisma/client';
import { ObjectId } from 'mongodb';
import { DatabaseService } from '@/database/database.service';
import { StorageService } from '@/storage/storage.service';
import { WebsocketService } from '@/websocket/websocket.service';
import { MessagesService } from '@/messages/messages.service';
import { ServerEvents } from '@/websocket/events.enum/server-events.enum';
import { getErrorMessage } from '@/common/utils/error.utils';
import { FfmpegService } from './ffmpeg.service';
import * as ffmpegModule from 'fluent-ffmpeg';
import {
  CaptureReplayDto,
  CaptureReplayResponseDto,
} from './dto/capture-replay.dto';
import {
  UpdateClipDto,
  ShareClipDto,
  ClipResponseDto,
  ShareClipResponseDto,
} from './dto/clip-library.dto';
import { createHash } from 'crypto';
import * as path from 'path';

@Injectable()
export class LivekitReplayService {
  private readonly logger = new Logger(LivekitReplayService.name);
  private readonly egressClient: EgressClient;
  private readonly segmentsPath: string;
  private readonly egressOutputPath: string;
  private readonly clipsPath: string;
  private readonly cleanupAgeMinutes: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    private readonly websocketService: WebsocketService,
    private readonly ffmpegService: FfmpegService,
    private readonly messagesService: MessagesService,
  ) {
    // Initialize LiveKit Egress client
    const livekitUrl = this.configService.get<string>('LIVEKIT_URL');
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET');

    if (!livekitUrl || !apiKey || !apiSecret) {
      this.logger.error('LiveKit configuration missing for egress client');
      throw new Error(
        'LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be set',
      );
    }

    this.egressClient = new EgressClient(livekitUrl, apiKey, apiSecret);

    // Load configuration
    // segmentsPath is now loaded from StorageService which handles prefix resolution
    this.segmentsPath = this.storageService.getSegmentsPrefix();
    this.egressOutputPath =
      this.configService.get<string>('REPLAY_EGRESS_OUTPUT_PATH') || '/out';

    // Convert clips path to absolute path for FFmpeg compatibility
    const rawClipsPath =
      this.configService.get<string>('REPLAY_CLIPS_PATH') ||
      './uploads/replays';
    this.clipsPath = path.resolve(rawClipsPath);

    this.cleanupAgeMinutes = parseInt(
      this.configService.get<string>('REPLAY_SEGMENT_CLEANUP_AGE_MINUTES') ||
        '20',
      10,
    );

    this.logger.log('LivekitReplayService initialized');
    this.logger.log(
      `Segments path (for reading): ${this.segmentsPath} (via StorageService)`,
    );
    this.logger.log(
      `Egress output path (for LiveKit API): ${this.egressOutputPath}`,
    );
    this.logger.log(`Clips path: ${this.clipsPath}`);
    this.logger.log(`Cleanup age: ${this.cleanupAgeMinutes} minutes`);
  }

  /**
   * Start replay buffer egress for a user's screen share
   *
   * Automatically stops any existing active session for the user before starting new one
   */
  async startReplayBuffer(params: {
    userId: string;
    channelId: string;
    roomName: string;
    videoTrackId: string;
    audioTrackId: string;
  }) {
    const { userId, channelId, roomName, videoTrackId, audioTrackId } = params;

    this.logger.log(
      `Starting replay buffer for user ${userId} in room ${roomName}`,
    );

    // Check if user already has an active session (enforce one session per user)
    const existingSession = await this.databaseService.egressSession.findFirst({
      where: {
        userId,
        status: 'active',
      },
    });

    if (existingSession) {
      this.logger.warn(
        `User ${userId} already has active session ${existingSession.egressId}, stopping it first`,
      );
      await this.stopReplayBuffer(userId);
    }

    // Create unique session ID for directory isolation using MongoDB ObjectId
    // We generate this BEFORE calling LiveKit API so we know the exact path
    // Format: Clean ObjectId string for S3/blob storage compatibility
    const sessionId = new ObjectId().toString();

    // Create unique segment path using LiveKit egress output directory
    // This is the path we tell LiveKit Egress to write to (absolute path for LiveKit API)
    // Organize by session directory for isolation, use {time} template for unique segment names
    const egressSegmentPath = `${this.egressOutputPath}/${sessionId}/{time}-segment`;

    // Configure segmented HLS output for replay buffer
    const outputs = {
      segments: new SegmentedFileOutput({
        filenamePrefix: egressSegmentPath,
        playlistName: 'playlist.m3u8',
        segmentDuration: 10, // 10-second segments
        protocol: SegmentedFileProtocol.HLS_PROTOCOL,
      }),
    };

    try {
      // Start track composite egress
      const egressInfo = await this.egressClient.startTrackCompositeEgress(
        roomName,
        outputs,
        {
          videoTrackId,
          audioTrackId,
          encodingOptions: EncodingOptionsPreset.H264_1080P_60,
        },
      );

      this.logger.log(
        `Egress started successfully: ${egressInfo.egressId} for user ${userId} in ${sessionId}`,
      );

      // Store RELATIVE path in DB (just the sessionId directory)
      // StorageService will resolve this to full path using REPLAY_SEGMENTS_PATH prefix
      const relativeSegmentPath = sessionId;

      const session = await this.databaseService.egressSession.create({
        data: {
          egressId: egressInfo.egressId,
          userId,
          roomName,
          channelId,
          segmentPath: relativeSegmentPath, // Store relative path for portability
          status: 'active',
          startedAt: new Date(),
        },
      });

      return {
        sessionId: session.id,
        egressId: session.egressId,
        status: session.status,
      };
    } catch (error) {
      this.logger.error(
        `Failed to start egress for user ${userId}: ${getErrorMessage(error)}`,
      );
      throw new BadRequestException('Failed to start replay buffer egress');
    }
  }

  /**
   * Stop replay buffer egress for a user
   *
   * Finds the user's active session and stops it
   */
  async stopReplayBuffer(userId: string) {
    this.logger.log(`Stopping replay buffer for user ${userId}`);

    // Find active session for user
    const session = await this.databaseService.egressSession.findFirst({
      where: {
        userId,
        status: 'active',
      },
    });

    if (!session) {
      this.logger.warn(`No active session found for user ${userId}`);
      throw new NotFoundException('No active replay buffer session found');
    }

    try {
      // Stop LiveKit egress
      await this.egressClient.stopEgress(session.egressId);
      this.logger.log(`Egress stopped: ${session.egressId}`);
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      // If egress doesn't exist on LiveKit side, that's fine - just update DB
      if (errorMsg.includes('egress does not exist')) {
        this.logger.warn(
          `Egress ${session.egressId} already stopped on LiveKit side, cleaning up database`,
        );
      } else {
        this.logger.error(
          `Failed to stop egress ${session.egressId}: ${errorMsg}`,
        );
        throw new BadRequestException('Failed to stop replay buffer egress');
      }
    }

    // Update session status in database (even if egress was already gone)
    await this.databaseService.egressSession.update({
      where: { id: session.id },
      data: {
        status: 'stopped',
        endedAt: new Date(),
      },
    });

    this.logger.log(
      `Session ${session.id} marked as stopped for user ${userId}`,
    );

    // Delete entire session directory (cleanup segments)
    // session.segmentPath is now relative, resolve it using StorageService
    try {
      await this.storageService.deleteSegmentDirectory(session.segmentPath, {
        recursive: true,
        force: true,
      });
      const resolvedPath = this.storageService.resolveSegmentPath(
        session.segmentPath,
      );
      this.logger.log(`Cleaned up segment directory: ${resolvedPath}`);
    } catch (cleanupError) {
      // Log but don't fail - cleanup is best-effort
      const resolvedPath = this.storageService.resolveSegmentPath(
        session.segmentPath,
      );
      this.logger.warn(
        `Failed to cleanup segments at ${resolvedPath}: ${getErrorMessage(cleanupError)}`,
      );
    }

    return {
      sessionId: session.id,
      egressId: session.egressId,
      status: 'stopped',
    };
  }

  /**
   * Handle egress ended event from LiveKit webhook
   *
   * Called when LiveKit automatically stops an egress (user disconnects, track ends, etc.)
   * Updates database and notifies user if egress failed
   *
   * @param egressId - LiveKit egress ID
   * @param status - Final status: 'stopped' or 'failed'
   * @param errorMessage - Optional error message if failed
   */
  async handleEgressEnded(
    egressId: string,
    status: 'stopped' | 'failed',
    errorMessage?: string,
  ) {
    this.logger.log(
      `Handling egress ended: ${egressId} with status: ${status}`,
    );

    // Find session by egress ID
    const session = await this.databaseService.egressSession.findUnique({
      where: { egressId },
    });

    if (!session) {
      this.logger.warn(
        `Received egress_ended for unknown egressId: ${egressId}`,
      );
      return;
    }

    // Don't update if already stopped/failed (idempotency)
    if (session.status !== 'active') {
      this.logger.debug(
        `Session ${session.id} already in status: ${session.status}, skipping update`,
      );
      return;
    }

    // Update session status in database
    await this.databaseService.egressSession.update({
      where: { id: session.id },
      data: {
        status,
        error: errorMessage,
        endedAt: new Date(),
      },
    });

    this.logger.log(
      `Session ${session.id} updated to status: ${status} for user ${session.userId}`,
    );

    // Delete entire session directory (cleanup segments)
    // session.segmentPath is now relative, resolve it using StorageService
    try {
      await this.storageService.deleteSegmentDirectory(session.segmentPath, {
        recursive: true,
        force: true,
      });
      const resolvedPath = this.storageService.resolveSegmentPath(
        session.segmentPath,
      );
      this.logger.log(`Cleaned up segment directory: ${resolvedPath}`);
    } catch (cleanupError) {
      // Log but don't fail - cleanup is best-effort
      const resolvedPath = this.storageService.resolveSegmentPath(
        session.segmentPath,
      );
      this.logger.warn(
        `Failed to cleanup segments at ${resolvedPath}: ${getErrorMessage(cleanupError)}`,
      );
    }

    // Send WebSocket event to user
    // In Socket.IO, users join a room with their userId
    if (status === 'failed') {
      this.websocketService.sendToRoom(
        session.userId,
        ServerEvents.REPLAY_BUFFER_FAILED,
        {
          sessionId: session.id,
          egressId: session.egressId,
          channelId: session.channelId,
          error: errorMessage || 'Unknown error',
        },
      );
      this.logger.log(
        `Sent REPLAY_BUFFER_FAILED event to user ${session.userId}`,
      );
    } else {
      this.websocketService.sendToRoom(
        session.userId,
        ServerEvents.REPLAY_BUFFER_STOPPED,
        {
          sessionId: session.id,
          egressId: session.egressId,
          channelId: session.channelId,
        },
      );
      this.logger.log(
        `Sent REPLAY_BUFFER_STOPPED event to user ${session.userId}`,
      );
    }
  }

  /**
   * Cleanup old segment files from active sessions
   *
   * Runs every 5 minutes, deletes segments older than REPLAY_SEGMENT_CLEANUP_AGE_MINUTES
   * Note: Playlist files (.m3u8) are continuously updated by LiveKit and won't be deleted
   */
  @Cron('*/5 * * * *')
  async cleanupOldSegments() {
    this.logger.debug('Running cleanup of old replay buffer segments...');

    try {
      // Find all active sessions
      const activeSessions = await this.databaseService.egressSession.findMany({
        where: { status: 'active' },
      });

      if (activeSessions.length === 0) {
        this.logger.debug('No active sessions to clean up');
        return;
      }

      const cutoffDate = new Date(
        Date.now() - this.cleanupAgeMinutes * 60 * 1000,
      );
      let totalDeleted = 0;

      for (const session of activeSessions) {
        try {
          // Resolve relative segment path to full path
          const resolvedPath = this.storageService.resolveSegmentPath(
            session.segmentPath,
          );

          // Check if segment directory exists
          const exists =
            await this.storageService.segmentDirectoryExists(
              session.segmentPath,
            );
          if (!exists) {
            this.logger.warn(`Segment path does not exist: ${resolvedPath}`);
            continue;
          }

          // Delete old files in the segment directory
          // This will delete old .ts segment files but preserve the .m3u8 playlist
          // (playlist is continuously updated so its mtime will be recent)
          const deletedCount = await this.storageService.deleteOldFiles(
            resolvedPath,
            cutoffDate,
          );

          totalDeleted += deletedCount;

          if (deletedCount > 0) {
            this.logger.debug(
              `Deleted ${deletedCount} old segments from session ${session.id}`,
            );
          }
        } catch (error) {
          this.logger.warn(
            `Failed to cleanup segments for session ${session.id}: ${getErrorMessage(error)}`,
          );
        }
      }

      if (totalDeleted > 0) {
        this.logger.log(`Cleaned up ${totalDeleted} old segment files`);
      } else {
        this.logger.debug('No old segments to clean up');
      }
    } catch (error) {
      this.logger.error(`Cleanup job failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Cleanup orphaned egress sessions
   *
   * Runs every hour to find and cleanup sessions that have been active for >3 hours
   * These are likely orphaned due to browser crashes, network issues, or server restarts
   */
  @Cron('0 * * * *') // Every hour at minute 0
  async cleanupOrphanedSessions() {
    this.logger.debug('Running cleanup of orphaned egress sessions...');

    try {
      // Find sessions that have been active for more than 3 hours
      const staleThreshold = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago

      const orphanedSessions =
        await this.databaseService.egressSession.findMany({
          where: {
            status: 'active',
            startedAt: { lt: staleThreshold },
          },
        });

      if (orphanedSessions.length === 0) {
        this.logger.debug('No orphaned sessions found');
        return;
      }

      this.logger.warn(
        `Found ${orphanedSessions.length} orphaned sessions, cleaning up...`,
      );

      let cleanedCount = 0;

      for (const session of orphanedSessions) {
        try {
          // Try to stop the egress (might already be stopped by LiveKit)
          try {
            await this.egressClient.stopEgress(session.egressId);
            this.logger.debug(`Stopped orphaned egress: ${session.egressId}`);
          } catch {
            // Egress might already be stopped - that's fine
            this.logger.debug(
              `Egress ${session.egressId} already stopped or not found`,
            );
          }

          // Update session status in database
          await this.databaseService.egressSession.update({
            where: { id: session.id },
            data: {
              status: 'stopped',
              endedAt: new Date(),
            },
          });

          // Delete segment directory
          // session.segmentPath is now relative, resolve it using StorageService
          const exists = await this.storageService.segmentDirectoryExists(
            session.segmentPath,
          );

          if (exists) {
            await this.storageService.deleteSegmentDirectory(
              session.segmentPath,
              {
                recursive: true,
                force: true,
              },
            );
            const resolvedPath = this.storageService.resolveSegmentPath(
              session.segmentPath,
            );
            this.logger.debug(`Deleted orphaned segments: ${resolvedPath}`);
          }

          cleanedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to cleanup orphaned session ${session.id}: ${getErrorMessage(error)}`,
          );
          // Continue with next session
        }
      }

      this.logger.log(
        `Cleaned up ${cleanedCount} orphaned sessions out of ${orphanedSessions.length} found`,
      );
    } catch (error) {
      this.logger.error(
        `Orphaned session cleanup job failed: ${getErrorMessage(error)}`,
      );
    }
  }

  /**
   * Reconcile egress status with LiveKit
   *
   * Runs every 10 minutes to verify that our database status matches LiveKit's actual egress status
   * This catches edge cases where webhooks might have been missed or failed
   */
  @Cron('*/10 * * * *') // Every 10 minutes
  async reconcileEgressStatus() {
    this.logger.debug('Running egress status reconciliation...');

    try {
      // Find all active sessions in our database
      const activeSessions = await this.databaseService.egressSession.findMany({
        where: { status: 'active' },
      });

      if (activeSessions.length === 0) {
        this.logger.debug('No active sessions to reconcile');
        return;
      }

      this.logger.debug(
        `Reconciling ${activeSessions.length} active sessions with LiveKit`,
      );

      let reconciledCount = 0;

      for (const session of activeSessions) {
        try {
          // Query LiveKit for actual egress status
          const egressInfoList = await this.egressClient.listEgress({
            egressId: session.egressId,
          });

          // Check if egress exists and is actually active
          const egressInfo =
            egressInfoList.length > 0 ? egressInfoList[0] : null;

          if (!egressInfo) {
            // Egress doesn't exist in LiveKit - mark as stopped
            this.logger.warn(
              `Egress ${session.egressId} not found in LiveKit, marking as stopped`,
            );

            await this.databaseService.egressSession.update({
              where: { id: session.id },
              data: {
                status: 'stopped',
                endedAt: new Date(),
              },
            });

            reconciledCount++;
            continue;
          }

          // Check LiveKit status
          const livekitStatus = egressInfo.status;

          // If LiveKit shows egress is not active, update our database
          if (
            livekitStatus !== EgressStatus.EGRESS_STARTING &&
            livekitStatus !== EgressStatus.EGRESS_ACTIVE
          ) {
            const isFailed =
              livekitStatus === EgressStatus.EGRESS_FAILED ||
              livekitStatus === EgressStatus.EGRESS_ABORTED;

            this.logger.warn(
              `Egress ${session.egressId} status mismatch: DB=active, LiveKit=${livekitStatus}`,
            );

            await this.databaseService.egressSession.update({
              where: { id: session.id },
              data: {
                status: isFailed ? 'failed' : 'stopped',
                endedAt: new Date(),
              },
            });

            // Notify user if egress failed
            if (isFailed) {
              this.websocketService.sendToRoom(
                session.userId,
                ServerEvents.REPLAY_BUFFER_FAILED,
                {
                  sessionId: session.id,
                  egressId: session.egressId,
                  channelId: session.channelId,
                  error: egressInfo.error || 'Unknown error',
                },
              );
            } else {
              this.websocketService.sendToRoom(
                session.userId,
                ServerEvents.REPLAY_BUFFER_STOPPED,
                {
                  sessionId: session.id,
                  egressId: session.egressId,
                  channelId: session.channelId,
                },
              );
            }

            reconciledCount++;
          }
        } catch (error) {
          this.logger.error(
            `Failed to reconcile session ${session.id}: ${getErrorMessage(error)}`,
          );
          // Continue with next session
        }
      }

      if (reconciledCount > 0) {
        this.logger.log(
          `Reconciled ${reconciledCount} sessions with LiveKit status`,
        );
      } else {
        this.logger.debug('All sessions are in sync with LiveKit');
      }
    } catch (error) {
      this.logger.error(
        `Egress status reconciliation job failed: ${getErrorMessage(error)}`,
      );
    }
  }

  /**
   * Stream a replay clip directly to the client (download-only, no persistence)
   * Creates a temporary file that should be deleted by the controller after streaming
   *
   * @param userId - ID of the user requesting the stream
   * @param durationMinutes - How many minutes to capture (1, 2, 5, or 10)
   * @returns Path to temporary MP4 file for streaming
   */
  async streamReplay(userId: string, durationMinutes: number): Promise<string> {
    this.logger.log(
      `Streaming ${durationMinutes}-minute replay for user ${userId}`,
    );

    // 1. Find active egress session for this user
    const session = await this.databaseService.egressSession.findFirst({
      where: {
        userId,
        status: 'active',
      },
    });

    if (!session) {
      throw new NotFoundException(
        'No active replay buffer session found. Start screen sharing first.',
      );
    }

    // 2. Calculate how many segments we need
    // Each segment is ~10 seconds, so 6 segments per minute
    const segmentsNeeded = durationMinutes * 6;

    // 3. Resolve relative segment path to full path
    const segmentDir = this.storageService.resolveSegmentPath(
      session.segmentPath,
    );

    // 4. List ALL segments in session directory and sort by sequence
    const allSegments = await this.listAndSortSegments(segmentDir);

    if (allSegments.length === 0) {
      throw new BadRequestException(
        'No segments available in replay buffer. Start screen sharing and wait for the buffer to accumulate.',
      );
    }

    // 5. Take ONLY the last N segments (most recent)
    const segments = allSegments.slice(-segmentsNeeded);

    this.logger.log(
      `Streaming ${segments.length} segments (requested ${segmentsNeeded}) from total ${allSegments.length} available`,
    );

    // 4. Create temp file path in /tmp
    const timestamp = Date.now();
    const tempFilename = `replay-stream-${userId}-${timestamp}.mp4`;
    const tempPath = path.join('/tmp', tempFilename);

    // 5. Concatenate segments with FFmpeg to temp file
    const segmentPaths = segments.map((s) => s.path);
    await this.ffmpegService.concatenateSegments(segmentPaths, tempPath);

    this.logger.log(`Created temp replay file for streaming at ${tempPath}`);

    return tempPath;
  }

  /**
   * Capture a replay clip from the buffer and post it to a channel or DM
   *
   * Takes the last N minutes of screen share segments, concatenates them into an MP4,
   * creates File and ReplayClip records, and posts a message with the clip attached.
   *
   * @param userId - ID of the user capturing the replay
   * @param dto - Capture request with duration and destination
   * @returns Response with clip info, download URL, and message ID
   */
  async captureReplay(
    userId: string,
    dto: CaptureReplayDto,
  ): Promise<CaptureReplayResponseDto> {
    const isCustomRange =
      dto.startSeconds !== undefined && dto.endSeconds !== undefined;
    const durationDescription = isCustomRange
      ? `custom range ${dto.startSeconds}s-${dto.endSeconds}s`
      : `${dto.durationMinutes}-minute preset`;

    this.logger.log(
      `Capturing ${durationDescription} replay for user ${userId} (destination: ${dto.destination})`,
    );

    // 1. Find active egress session for this user
    const session = await this.databaseService.egressSession.findFirst({
      where: {
        userId,
        status: 'active',
      },
    });

    if (!session) {
      throw new NotFoundException(
        'No active replay buffer session found. Start screen sharing first.',
      );
    }

    // 2. Resolve relative segment path to full path
    const segmentDir = this.storageService.resolveSegmentPath(
      session.segmentPath,
    );

    // 3. List ALL segments in session directory and sort by sequence
    const allSegments = await this.listAndSortSegments(segmentDir);

    if (allSegments.length === 0) {
      throw new BadRequestException(
        'No segments available in replay buffer. Start screen sharing and wait for the buffer to accumulate.',
      );
    }

    // 4. Select segments based on preset or custom range
    let segments: typeof allSegments;
    let trimOptions: { startOffset: number; duration: number } | undefined =
      undefined;

    if (isCustomRange) {
      // Custom range: calculate segment indices from timestamps
      const startSegmentIndex = Math.floor(dto.startSeconds! / 10);
      const endSegmentIndex = Math.ceil(dto.endSeconds! / 10);

      // Validate range
      if (startSegmentIndex >= allSegments.length) {
        throw new BadRequestException(
          `Start time ${dto.startSeconds}s exceeds available buffer (${allSegments.length * 10}s)`,
        );
      }
      if (endSegmentIndex > allSegments.length) {
        throw new BadRequestException(
          `End time ${dto.endSeconds}s exceeds available buffer (${allSegments.length * 10}s)`,
        );
      }
      if (dto.startSeconds! >= dto.endSeconds!) {
        throw new BadRequestException('Start time must be before end time');
      }

      segments = allSegments.slice(startSegmentIndex, endSegmentIndex);

      // Calculate precise trim options for FFmpeg
      // startOffset: how many seconds into the first segment to skip
      // duration: exact clip duration requested
      const startOffset = dto.startSeconds! - startSegmentIndex * 10;
      const exactDuration = dto.endSeconds! - dto.startSeconds!;

      if (startOffset > 0 || exactDuration !== segments.length * 10) {
        trimOptions = {
          startOffset,
          duration: exactDuration,
        };
        this.logger.log(
          `Precise trim: skip ${startOffset}s into first segment, exact duration ${exactDuration}s`,
        );
      }
    } else {
      // Preset duration: take last N segments
      const segmentsNeeded = (dto.durationMinutes || 1) * 6;
      segments = allSegments.slice(-segmentsNeeded);
    }

    // Estimate duration for logging (actual will come from FFmpeg probe)
    const estimatedDurationSeconds = trimOptions
      ? trimOptions.duration
      : segments.length * 10;

    this.logger.log(
      `Selected ${segments.length} segments from total ${allSegments.length} available. Estimated: ${estimatedDurationSeconds}s`,
    );

    // 6. Prepare output path
    const timestamp = Date.now();
    const clipFilename = `replay-${timestamp}.mp4`;
    const userClipsDir = path.join(this.clipsPath, userId);
    const clipPath = path.join(userClipsDir, clipFilename);

    // Ensure clips directory exists
    await this.storageService.ensureDirectory(userClipsDir);

    // 7. Concatenate segments with FFmpeg (with optional precise trimming)
    const segmentPaths = segments.map((s) => s.path);
    await this.ffmpegService.concatenateSegments(
      segmentPaths,
      clipPath,
      trimOptions,
    );

    // 8. Get ACTUAL duration from FFmpeg probe (not estimated)
    const actualDurationRaw =
      await this.ffmpegService.getVideoDuration(clipPath);
    const actualDurationSeconds = Math.round(actualDurationRaw);

    this.logger.log(
      `Actual video duration: ${actualDurationSeconds}s (estimated: ${estimatedDurationSeconds}s)`,
    );

    // 9. Get file stats and generate checksum
    const stats = await this.storageService.getFileStats(clipPath);
    const checksum = await this.generateChecksum(clipPath);

    // 7. Create File record with REPLAY_CLIP resourceType
    // resourceId stays as userId for clip library ownership
    const file = await this.databaseService.file.create({
      data: {
        filename: clipFilename,
        mimeType: 'video/mp4',
        fileType: 'VIDEO',
        size: stats.size,
        checksum,
        uploadedById: userId,
        storageType: 'LOCAL',
        storagePath: clipPath,
        resourceType: 'REPLAY_CLIP',
        resourceId: userId, // Clip owner (doesn't change when shared)
      },
    });

    this.logger.log(`Created file record: ${file.id}`);

    // 8. Create ReplayClip record
    const clip = await this.databaseService.replayClip.create({
      data: {
        userId,
        fileId: file.id,
        channelId: session.channelId,
        durationSeconds: actualDurationSeconds,
      },
    });

    this.logger.log(
      `Successfully created replay clip ${clip.id} (${stats.size} bytes, ${actualDurationSeconds}s)`,
    );

    // 9. Optionally create message with clip attachment (for channel/dm destinations)
    let messageId: string | undefined;

    if (dto.destination === 'channel' || dto.destination === 'dm') {
      const sizeMB = Math.round(stats.size / 1024 / 1024);

      // Construct message payload using MessageUncheckedCreateInput type
      // This ensures Prisma accepts scalar channelId/directMessageGroupId fields
      const messagePayload: Prisma.MessageUncheckedCreateInput = {
        channelId:
          dto.destination === 'channel' && dto.targetChannelId
            ? dto.targetChannelId
            : null,
        directMessageGroupId:
          dto.destination === 'dm' && dto.targetDirectMessageGroupId
            ? dto.targetDirectMessageGroupId
            : null,
        authorId: userId,
        sentAt: new Date(),
        spans: [
          {
            type: 'PLAINTEXT',
            text: `Replay clip - ${actualDurationSeconds}s (${sizeMB}MB)`,
            userId: null,
            specialKind: null,
            communityId: null,
            aliasId: null,
          },
        ],
        attachments: [file.id],
        pendingAttachments: 0,
      };

      this.logger.log(`Creating message with file attachment: ${file.id}`);
      const message = await this.messagesService.create(messagePayload as any);

      this.logger.log(
        `Posted replay clip message ${message.id} to ${dto.destination} with attachments: ${JSON.stringify(message.attachments)}`,
      );

      messageId = message.id;
    } else {
      this.logger.log(
        `Clip saved to library only (destination: ${dto.destination})`,
      );
    }

    // 10. Return response with download URL and optional message ID
    const requestedDurationSeconds = isCustomRange
      ? dto.endSeconds! - dto.startSeconds!
      : (dto.durationMinutes || 1) * 60;

    return {
      clipId: clip.id,
      fileId: file.id,
      durationSeconds: actualDurationSeconds,
      requestedDurationSeconds,
      sizeBytes: stats.size,
      downloadUrl: `/file/${file.id}`,
      messageId,
    };
  }

  /**
   * List all segments in directory and sort by sequence number
   *
   * Filenames follow format: 2025-11-15T040603-segment_00000.ts
   * Extracts sequence number (_00000) for proper ordering since timestamps are identical
   *
   * @param segmentDir - Directory containing segment files
   * @returns Array of segment info sorted by sequence number (oldest first)
   * @private
   */
  private async listAndSortSegments(
    segmentDir: string,
  ): Promise<Array<{ filename: string; sequence: number; path: string }>> {
    try {
      const files = await this.storageService.listFiles(segmentDir, {
        filter: (filename) =>
          filename.endsWith('.ts') && filename.includes('segment'),
      });

      const segments: Array<{
        filename: string;
        sequence: number;
        path: string;
      }> = [];

      for (const filename of files) {
        // Extract sequence number from filename
        // Format: 2025-11-15T040603-segment_00000.ts
        const sequenceMatch = filename.match(/_(\d+)\.ts$/);

        if (sequenceMatch) {
          const sequence = parseInt(sequenceMatch[1], 10);
          segments.push({
            filename,
            sequence,
            path: path.join(segmentDir, filename),
          });
        } else {
          this.logger.warn(`Skipping file with unexpected format: ${filename}`);
        }
      }

      // Sort by sequence number (oldest to newest)
      return segments.sort((a, b) => a.sequence - b.sequence);
    } catch (error) {
      this.logger.error(
        `Failed to list segments in ${segmentDir}: ${getErrorMessage(error)}`,
      );
      return [];
    }
  }

  /**
   * Generate SHA-256 checksum for a file
   *
   * @param filePath - Path to the file
   * @returns Hex-encoded SHA-256 hash
   * @private
   */
  private async generateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = this.storageService.createReadStream(filePath);

      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Get session info for the user's active replay buffer
   * Used by frontend to display buffer status and available segments
   *
   * @param userId - ID of the user
   * @returns Session info including segment count and duration
   */
  async getSessionInfo(userId: string): Promise<{
    hasActiveSession: boolean;
    sessionId?: string;
    totalSegments?: number;
    totalDurationSeconds?: number;
    bufferStartTime?: Date;
    bufferEndTime?: Date;
  }> {
    const session = await this.databaseService.egressSession.findFirst({
      where: {
        userId,
        status: 'active',
      },
    });

    if (!session) {
      return { hasActiveSession: false };
    }

    // Resolve relative segment path to full path
    const segmentDir = this.storageService.resolveSegmentPath(
      session.segmentPath,
    );
    const segments = await this.listAndSortSegments(segmentDir);

    if (segments.length === 0) {
      return {
        hasActiveSession: true,
        sessionId: session.id,
        totalSegments: 0,
        totalDurationSeconds: 0,
      };
    }

    // Count only complete segments (10KB+ to filter out segments being written)
    let completeSegmentCount = 0;
    for (const segment of segments) {
      try {
        const stats = await this.storageService.getFileStats(segment.path);
        if (stats.size >= 10000) {
          completeSegmentCount++;
        }
      } catch {
        // Skip segments we can't stat
      }
    }

    const totalDurationSeconds = completeSegmentCount * 10; // Each segment is ~10 seconds

    return {
      hasActiveSession: true,
      sessionId: session.id,
      totalSegments: completeSegmentCount,
      totalDurationSeconds,
      bufferStartTime: session.startedAt,
      bufferEndTime: new Date(), // Segments are being created in real-time
    };
  }

  /**
   * Get the HLS playlist content for the user's active session
   * Generates a valid m3u8 playlist that references all available segments
   *
   * @param userId - ID of the user
   * @returns m3u8 playlist content as string
   */
  async getPlaylistContent(userId: string): Promise<string> {
    const session = await this.databaseService.egressSession.findFirst({
      where: {
        userId,
        status: 'active',
      },
    });

    if (!session) {
      throw new NotFoundException('No active replay buffer session found.');
    }

    // Resolve relative segment path to full path
    const segmentDir = this.storageService.resolveSegmentPath(
      session.segmentPath,
    );
    const segments = await this.listAndSortSegments(segmentDir);

    if (segments.length === 0) {
      throw new BadRequestException('No segments available in buffer.');
    }

    // Filter out incomplete segments (the latest segment is often still being written)
    // A valid segment should be at least 10KB (has headers + some data)
    const completeSegments: typeof segments = [];
    for (const segment of segments) {
      try {
        const stats = await this.storageService.getFileStats(segment.path);
        if (stats.size >= 10000) {
          completeSegments.push(segment);
        } else {
          this.logger.debug(
            `Excluding incomplete segment from playlist: ${segment.filename} (${stats.size} bytes)`,
          );
        }
      } catch {
        // If we can't stat the file, skip it
        this.logger.warn(
          `Could not stat segment ${segment.filename}, excluding from playlist`,
        );
      }
    }

    if (completeSegments.length === 0) {
      throw new BadRequestException(
        'No complete segments available in buffer yet. Please wait a moment.',
      );
    }

    // Generate m3u8 playlist with absolute segment URLs
    const lines = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-TARGETDURATION:10',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-PLAYLIST-TYPE:EVENT', // Indicate this is a growing playlist
    ];

    for (const segment of completeSegments) {
      lines.push(`#EXTINF:10.0,`);
      // Use absolute URL that maps to our segment endpoint
      lines.push(`/api/livekit/replay/preview/segment/${segment.filename}`);
    }

    // Add ENDLIST to indicate this is the complete playlist for preview purposes
    // Without this, HLS.js may only load the last few segments thinking it's live
    lines.push('#EXT-X-ENDLIST');

    return lines.join('\n');
  }

  /**
   * Get the full path to a specific segment file
   * Verifies that the segment belongs to the user's active session
   *
   * @param userId - ID of the user
   * @param segmentFile - Filename of the segment (e.g., "2025-11-15T040603-segment_00000.ts")
   * @returns Full path to the segment file
   */
  async getSegmentPath(userId: string, segmentFile: string): Promise<string> {
    const session = await this.databaseService.egressSession.findFirst({
      where: {
        userId,
        status: 'active',
      },
    });

    if (!session) {
      throw new NotFoundException('No active replay buffer session found.');
    }

    // Validate segment filename format to prevent path traversal
    if (
      !segmentFile.match(/^[\w-]+\.ts$/) ||
      segmentFile.includes('..') ||
      segmentFile.includes('/')
    ) {
      throw new BadRequestException('Invalid segment filename.');
    }

    // Resolve relative session path to full path, then join with segment filename
    const resolvedSessionDir = this.storageService.resolveSegmentPath(
      session.segmentPath,
    );
    const segmentPath = path.join(resolvedSessionDir, segmentFile);

    // Verify file exists
    const exists = await this.storageService.fileExists(segmentPath);
    if (!exists) {
      throw new NotFoundException(`Segment ${segmentFile} not found.`);
    }

    return segmentPath;
  }

  /**
   * Get a remuxed segment file path for HLS.js compatibility
   * LiveKit egress creates HDMV-style MPEG-TS which HLS.js can't parse.
   * This method remuxes the segment to standard MPEG-TS format.
   *
   * @param userId - ID of the user
   * @param segmentFile - Filename of the segment
   * @returns Full path to the remuxed segment file
   */
  async getRemuxedSegmentPath(
    userId: string,
    segmentFile: string,
  ): Promise<string> {
    const originalPath = await this.getSegmentPath(userId, segmentFile);

    // Create a cache directory for remuxed segments
    const cacheDir = `/tmp/hls-remux-cache/${userId}`;
    await this.storageService.ensureDirectory(cacheDir);

    const remuxedPath = path.join(cacheDir, segmentFile);

    // Check if already remuxed
    const remuxedExists = await this.storageService.fileExists(remuxedPath);
    if (remuxedExists) {
      return remuxedPath;
    }

    // Check if the segment file is large enough to be complete
    // A valid segment should be at least a few KB (has headers + some data)
    const stats = await this.storageService.getFileStats(originalPath);
    if (stats.size < 10000) {
      // Less than 10KB, likely incomplete
      this.logger.warn(
        `Segment ${segmentFile} appears incomplete (${stats.size} bytes), serving original`,
      );
      // Return original path - HLS.js will fail but it's better than crashing
      return originalPath;
    }

    // Remux using FFmpeg to convert HDMV-TS to standard MPEG-TS
    // This is a fast stream copy operation, not transcoding
    this.logger.debug(`Remuxing segment ${segmentFile} for HLS.js`);

    try {
      await this.remuxSegment(originalPath, remuxedPath);
    } catch (error) {
      this.logger.error(
        `Failed to remux segment ${segmentFile}: ${getErrorMessage(error)}`,
      );
      // If remuxing fails, return the original path as fallback
      // This allows the player to at least try to play it
      return originalPath;
    }

    return remuxedPath;
  }

  /**
   * Remux a single segment file to standard MPEG-TS format
   * Uses stream copy for speed, no re-encoding needed
   *
   * @param inputPath - Path to original HDMV-style segment
   * @param outputPath - Path for remuxed segment
   * @private
   */
  private async remuxSegment(
    inputPath: string,
    outputPath: string,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      ffmpegModule(inputPath)
        .outputOptions([
          '-c copy', // Stream copy, no transcoding
          '-f mpegts', // Force standard MPEG-TS output (re-muxes stream IDs)
        ])
        .output(outputPath)
        .on('end', () => {
          this.logger.debug(`Successfully remuxed segment to ${outputPath}`);
          resolve();
        })
        .on('error', (err: Error) => {
          this.logger.error(`Failed to remux segment: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Get all clips for a user (their own library)
   *
   * @param userId - ID of the user
   * @returns Array of clips with file metadata
   */
  async getUserClips(userId: string): Promise<ClipResponseDto[]> {
    this.logger.log(`Fetching clips for user ${userId}`);

    const clips = await this.databaseService.replayClip.findMany({
      where: { userId },
      include: {
        file: {
          select: {
            id: true,
            filename: true,
            size: true,
          },
        },
      },
      orderBy: { capturedAt: 'desc' },
    });

    return clips.map((clip) => ({
      id: clip.id,
      fileId: clip.fileId,
      channelId: clip.channelId,
      durationSeconds: clip.durationSeconds,
      isPublic: clip.isPublic,
      capturedAt: clip.capturedAt,
      downloadUrl: `/file/${clip.fileId}`,
      sizeBytes: clip.file.size,
      filename: clip.file.filename,
    }));
  }

  /**
   * Get public clips for a user (visible on their profile)
   *
   * @param userId - ID of the user whose public clips to fetch
   * @returns Array of public clips with file metadata
   */
  async getPublicClips(userId: string): Promise<ClipResponseDto[]> {
    this.logger.log(`Fetching public clips for user ${userId}`);

    const clips = await this.databaseService.replayClip.findMany({
      where: {
        userId,
        isPublic: true,
      },
      include: {
        file: {
          select: {
            id: true,
            filename: true,
            size: true,
          },
        },
      },
      orderBy: { capturedAt: 'desc' },
    });

    return clips.map((clip) => ({
      id: clip.id,
      fileId: clip.fileId,
      channelId: clip.channelId,
      durationSeconds: clip.durationSeconds,
      isPublic: clip.isPublic,
      capturedAt: clip.capturedAt,
      downloadUrl: `/file/${clip.fileId}`,
      sizeBytes: clip.file.size,
      filename: clip.file.filename,
    }));
  }

  /**
   * Update a clip (e.g., toggle public visibility)
   *
   * @param userId - ID of the user (for ownership verification)
   * @param clipId - ID of the clip to update
   * @param dto - Update data
   * @returns Updated clip
   */
  async updateClip(
    userId: string,
    clipId: string,
    dto: UpdateClipDto,
  ): Promise<ClipResponseDto> {
    this.logger.log(`Updating clip ${clipId} for user ${userId}`);

    // Verify ownership
    const clip = await this.databaseService.replayClip.findFirst({
      where: { id: clipId, userId },
      include: {
        file: {
          select: {
            id: true,
            filename: true,
            size: true,
          },
        },
      },
    });

    if (!clip) {
      throw new NotFoundException('Clip not found or access denied');
    }

    // Update clip
    const updatedClip = await this.databaseService.replayClip.update({
      where: { id: clipId },
      data: {
        ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
      },
      include: {
        file: {
          select: {
            id: true,
            filename: true,
            size: true,
          },
        },
      },
    });

    this.logger.log(`Updated clip ${clipId}: isPublic=${updatedClip.isPublic}`);

    return {
      id: updatedClip.id,
      fileId: updatedClip.fileId,
      channelId: updatedClip.channelId,
      durationSeconds: updatedClip.durationSeconds,
      isPublic: updatedClip.isPublic,
      capturedAt: updatedClip.capturedAt,
      downloadUrl: `/file/${updatedClip.fileId}`,
      sizeBytes: updatedClip.file.size,
      filename: updatedClip.file.filename,
    };
  }

  /**
   * Delete a clip from user's library
   *
   * @param userId - ID of the user (for ownership verification)
   * @param clipId - ID of the clip to delete
   */
  async deleteClip(userId: string, clipId: string): Promise<void> {
    this.logger.log(`Deleting clip ${clipId} for user ${userId}`);

    // Verify ownership and get file info
    const clip = await this.databaseService.replayClip.findFirst({
      where: { id: clipId, userId },
      include: {
        file: {
          select: {
            id: true,
            storagePath: true,
          },
        },
      },
    });

    if (!clip) {
      throw new NotFoundException('Clip not found or access denied');
    }

    // Delete clip record (will cascade delete due to relation)
    await this.databaseService.replayClip.delete({
      where: { id: clipId },
    });

    // Delete file record
    await this.databaseService.file.delete({
      where: { id: clip.fileId },
    });

    // Delete actual file from storage
    try {
      if (clip.file.storagePath) {
        await this.storageService.deleteFile(clip.file.storagePath);
        this.logger.log(`Deleted file from storage: ${clip.file.storagePath}`);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to delete file from storage: ${getErrorMessage(error)}`,
      );
      // Don't throw - DB records are already deleted
    }

    this.logger.log(`Successfully deleted clip ${clipId}`);
  }

  /**
   * Share an existing clip to a channel or DM
   *
   * Creates a message with the clip attached without creating a new clip
   *
   * @param userId - ID of the user sharing the clip
   * @param clipId - ID of the clip to share
   * @param dto - Share destination details
   * @returns Response with message ID
   */
  async shareClip(
    userId: string,
    clipId: string,
    dto: ShareClipDto,
  ): Promise<ShareClipResponseDto> {
    this.logger.log(`Sharing clip ${clipId} to ${dto.destination}`);

    // Verify ownership
    const clip = await this.databaseService.replayClip.findFirst({
      where: { id: clipId, userId },
      include: {
        file: {
          select: {
            id: true,
            size: true,
          },
        },
      },
    });

    if (!clip) {
      throw new NotFoundException('Clip not found or access denied');
    }

    const sizeMB = Math.round(clip.file.size / 1024 / 1024);

    // Create message with clip attached
    const messagePayload: Prisma.MessageUncheckedCreateInput = {
      channelId:
        dto.destination === 'channel' && dto.targetChannelId
          ? dto.targetChannelId
          : null,
      directMessageGroupId:
        dto.destination === 'dm' && dto.targetDirectMessageGroupId
          ? dto.targetDirectMessageGroupId
          : null,
      authorId: userId,
      sentAt: new Date(),
      spans: [
        {
          type: 'PLAINTEXT',
          text: `Replay clip - ${clip.durationSeconds}s (${sizeMB}MB)`,
          userId: null,
          specialKind: null,
          communityId: null,
          aliasId: null,
        },
      ],
      attachments: [clip.fileId],
      pendingAttachments: 0,
    };

    const message = await this.messagesService.create(messagePayload as any);

    // Enrich with file metadata for WebSocket clients
    const enrichedMessage =
      await this.messagesService.enrichMessageWithFileMetadata(message);

    // Emit WebSocket event to notify channel/DM members
    if (dto.destination === 'channel' && dto.targetChannelId) {
      this.websocketService.sendToRoom(
        dto.targetChannelId,
        ServerEvents.NEW_MESSAGE,
        { message: enrichedMessage },
      );
    } else if (dto.destination === 'dm' && dto.targetDirectMessageGroupId) {
      this.websocketService.sendToRoom(
        dto.targetDirectMessageGroupId,
        ServerEvents.NEW_DM,
        { message: enrichedMessage },
      );
    }

    this.logger.log(
      `Shared clip ${clipId} to ${dto.destination} via message ${message.id}`,
    );

    return {
      messageId: message.id,
      clipId: clip.id,
      destination: dto.destination,
    };
  }
}
