import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import {
  EgressClient,
  RoomServiceClient,
  SegmentedFileOutput,
  SegmentedFileProtocol,
  EncodingOptions,
  EncodingOptionsPreset,
  EgressStatus,
  VideoCodec,
  AudioCodec,
  TrackType,
} from 'livekit-server-sdk';
import { randomUUID } from 'crypto';
import { DatabaseService } from '@/database/database.service';
import { StorageService } from '@/storage/storage.service';
import { WebsocketService } from '@/websocket/websocket.service';
import { ServerEvents } from '@semaphore-chat/shared';
import { RoomName } from '@/common/utils/room-name.util';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  ClipMessageCreateEvent,
  emitClipMessageCreate,
} from '@/common/events/clip-message.events';
import {
  VOICE_USER_LEFT,
  VoiceUserLeftEvent,
} from '@/common/events/voice-presence.events';
import { getErrorMessage } from '@/common/utils/error.utils';
import { ThumbnailService } from '@/file/thumbnail.service';
import { FfmpegService } from './ffmpeg.service';
import { ReplaySegmentsService } from './replay-segments.service';
import {
  CaptureReplayDto,
  CaptureReplayResponseDto,
} from './dto/capture-replay.dto';
import { createHash } from 'crypto';
import * as path from 'path';
import { EGRESS_CLIENT } from './providers/egress-client.provider';
import { ROOM_SERVICE_CLIENT } from './providers/room-service.provider';

@Injectable()
export class LivekitReplayService {
  private readonly logger = new Logger(LivekitReplayService.name);
  private readonly segmentsPath: string;
  private readonly egressOutputPath: string;
  private readonly clipsPath: string;

  constructor(
    @Inject(EGRESS_CLIENT)
    private readonly egressClient: EgressClient,
    @Inject(ROOM_SERVICE_CLIENT)
    private readonly roomServiceClient: RoomServiceClient,
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    private readonly websocketService: WebsocketService,
    private readonly ffmpegService: FfmpegService,
    private readonly replaySegmentsService: ReplaySegmentsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly thumbnailService: ThumbnailService,
  ) {
    // Load configuration
    // segmentsPath is now loaded from StorageService which handles prefix resolution
    this.segmentsPath = this.storageService.getSegmentsPrefix();
    this.egressOutputPath =
      this.configService.get<string>('REPLAY_EGRESS_OUTPUT_PATH') || '/out';

    // Convert clips path to absolute path for FFmpeg compatibility
    // Default must be absolute — relative paths resolve against process.cwd()
    // (/app/backend), but the uploads volume is mounted at /app/uploads.
    const rawClipsPath =
      this.configService.get<string>('REPLAY_CLIPS_PATH') ||
      '/app/uploads/replays';
    this.clipsPath = path.resolve(rawClipsPath);

    this.logger.log('LivekitReplayService initialized');
    this.logger.log(
      `Segments path (for reading): ${this.segmentsPath} (via StorageService)`,
    );
    this.logger.log(
      `Egress output path (for LiveKit API): ${this.egressOutputPath}`,
    );
    this.logger.log(`Clips path: ${this.clipsPath}`);
  }

  /**
   * Start replay buffer egress for a user's screen share
   *
   * Automatically stops any existing active session for the user before starting new one.
   * Queries the source track to match encoding resolution to the actual screen share quality.
   */
  async startReplayBuffer(params: {
    userId: string;
    channelId: string;
    roomName: string;
    videoTrackId: string;
    audioTrackId?: string;
    participantIdentity?: string;
  }) {
    const {
      userId,
      channelId,
      roomName,
      videoTrackId,
      audioTrackId,
      participantIdentity,
    } = params;

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

    // Create unique session ID for directory isolation
    // We generate this BEFORE calling LiveKit API so we know the exact path
    const sessionId = randomUUID();

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
      // Query track resolution to match egress encoding to source quality
      let encodingOptions: EncodingOptions | EncodingOptionsPreset =
        EncodingOptionsPreset.H264_1080P_30;

      if (participantIdentity) {
        try {
          const participant = await this.roomServiceClient.getParticipant(
            roomName,
            participantIdentity,
          );

          const videoTrack = participant.tracks.find(
            (track) =>
              track.sid === videoTrackId && track.type === TrackType.VIDEO,
          );

          if (videoTrack?.width && videoTrack?.height) {
            // Calculate intelligent bitrate based on resolution
            // Screen content needs higher bitrates than camera for sharp text/edges
            const videoBitrate = this.calculateVideoBitrate(
              videoTrack.width,
              videoTrack.height,
            );

            // Create custom encoding options matching source track resolution
            encodingOptions = new EncodingOptions({
              width: videoTrack.width,
              height: videoTrack.height,
              framerate: 30, // Cap at 30fps for reasonable file sizes
              videoCodec: VideoCodec.H264_HIGH,
              videoBitrate, // Intelligent bitrate based on resolution
              audioBitrate: 128000, // 128kbps audio
              audioCodec: AudioCodec.AAC,
            });

            this.logger.log(
              `Using source track: ${videoTrack.width}x${videoTrack.height} @ ${videoBitrate / 1000}kbps`,
            );
          } else {
            this.logger.warn(
              `Track ${videoTrackId} has no resolution info, using default preset`,
            );
          }
        } catch (queryError) {
          this.logger.warn(
            `Failed to query track resolution, using default preset: ${getErrorMessage(queryError)}`,
          );
        }
      } else {
        this.logger.log(
          'No participantIdentity provided, using default encoding preset',
        );
      }

      // Start track composite egress
      const egressInfo = await this.egressClient.startTrackCompositeEgress(
        roomName,
        outputs,
        {
          videoTrackId,
          ...(audioTrackId ? { audioTrackId } : {}),
          encodingOptions,
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

      // Schedule a delayed check to notify the client when segments are available
      setTimeout(() => {
        this.checkAndNotifySegmentsReady(session.id, userId, channelId).catch(
          (err) =>
            this.logger.warn(
              `Segment readiness check failed: ${getErrorMessage(err)}`,
            ),
        );
      }, 15_000);

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
   * Check if segments are available and notify the user via WebSocket.
   */
  private async checkAndNotifySegmentsReady(
    sessionId: string,
    userId: string,
    channelId: string,
  ): Promise<void> {
    const session = await this.databaseService.egressSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.status !== 'active') return;

    // Check if segments exist on disk
    const segments = await this.storageService.listFiles(session.segmentPath);
    if (segments.length > 0) {
      this.websocketService.sendToRoom(
        RoomName.user(userId),
        ServerEvents.EGRESS_SEGMENTS_READY,
        { sessionId, channelId },
      );
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
   * Stop any active replay buffer when a user leaves a voice channel.
   *
   * Fired by VoicePresenceService via a domain event so the voice-presence
   * module does not need to import the LiveKit module (which would create a
   * circular module dependency). Cleanup is best-effort: a missing session
   * (404) is expected and other errors are logged, never re-thrown.
   */
  @OnEvent(VOICE_USER_LEFT)
  async handleVoiceUserLeft({ userId }: VoiceUserLeftEvent): Promise<void> {
    try {
      await this.stopReplayBuffer(userId);
    } catch (error: unknown) {
      // Ignore if no session found (404), log other errors
      const isNotFoundError =
        error instanceof Error &&
        'status' in error &&
        (error as Error & { status: number }).status === 404;
      if (!isNotFoundError) {
        this.logger.warn(
          `Failed to stop replay buffer on voice leave for user ${userId}: ${getErrorMessage(error)}`,
        );
      }
    }
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
        RoomName.user(session.userId),
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
        RoomName.user(session.userId),
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
   * Reconcile egress status with LiveKit
   *
   * Runs every 1 minute to verify that our database status matches LiveKit's actual egress status
   * This catches edge cases where webhooks might have been missed or failed
   */
  @Cron('*/1 * * * *') // Every 1 minute
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
                RoomName.user(session.userId),
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
                RoomName.user(session.userId),
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

    // 4. List only complete segments (>= 10KB) to avoid corrupt/partial data
    const allSegments =
      await this.replaySegmentsService.listCompleteSegments(segmentDir);

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

    // 3. List only complete segments (>= 10KB) to avoid corrupt/partial data
    const allSegments =
      await this.replaySegmentsService.listCompleteSegments(segmentDir);

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
      if (dto.startSeconds! >= dto.endSeconds!) {
        throw new BadRequestException('Start time must be before end time');
      }

      // Custom range: calculate segment indices from timestamps
      const startSegmentIndex = Math.floor(dto.startSeconds! / 10);
      const endSegmentIndex = Math.ceil(dto.endSeconds! / 10);

      // Clamp to available segments instead of throwing
      const clampedStart = Math.min(
        startSegmentIndex,
        Math.max(0, allSegments.length - 1),
      );
      const clampedEnd = Math.min(endSegmentIndex, allSegments.length);

      if (clampedStart >= clampedEnd) {
        throw new BadRequestException(
          'Requested range has no available segments. The buffer may have been cleaned up.',
        );
      }

      if (
        clampedStart !== startSegmentIndex ||
        clampedEnd !== endSegmentIndex
      ) {
        this.logger.warn(
          `Clamped capture range: requested [${startSegmentIndex}, ${endSegmentIndex}) -> available [${clampedStart}, ${clampedEnd})`,
        );
      }

      segments = allSegments.slice(clampedStart, clampedEnd);

      // Calculate precise trim options for FFmpeg
      // startOffset: how many seconds into the first segment to skip
      const startOffset = dto.startSeconds! - clampedStart * 10;
      const clampedEndSeconds = Math.min(dto.endSeconds!, clampedEnd * 10);
      const exactDuration = clampedEndSeconds - dto.startSeconds!;

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
    let actualDurationSeconds: number;
    try {
      const actualDurationRaw =
        await this.ffmpegService.getVideoDuration(clipPath);
      actualDurationSeconds = Math.round(actualDurationRaw);
      // Fallback to estimated duration if probe fails or returns invalid value
      if (
        !Number.isFinite(actualDurationSeconds) ||
        actualDurationSeconds <= 0
      ) {
        this.logger.warn(
          `FFprobe returned invalid duration (${actualDurationRaw}), using estimated: ${estimatedDurationSeconds}s`,
        );
        actualDurationSeconds = estimatedDurationSeconds;
      }
    } catch (probeError) {
      this.logger.warn(
        `FFprobe failed, using estimated duration: ${estimatedDurationSeconds}s`,
        probeError,
      );
      actualDurationSeconds = estimatedDurationSeconds;
    }

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
        fileUserId: userId, // Clip owner (doesn't change when shared)
      },
    });

    this.logger.log(`Created file record: ${file.id}`);

    // Generate thumbnail for the video clip before the message is created,
    // so the broadcast/cached message carries hasThumbnail: true.
    // Failure is non-fatal — the clip is still posted without a thumbnail.
    await this.generateThumbnail(clipPath, file.id);

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

    // Authorization: verify the user can post to the target destination
    if (dto.destination === 'channel' && dto.targetChannelId) {
      const channel = await this.databaseService.channel.findUnique({
        where: { id: dto.targetChannelId },
      });
      if (!channel) {
        throw new NotFoundException('Target channel not found');
      }
      const membership = await this.databaseService.membership.findFirst({
        where: { userId, communityId: channel.communityId },
      });
      if (!membership) {
        throw new ForbiddenException(
          "You are not a member of the target channel's community",
        );
      }
      // Private channels require explicit channel membership
      if (channel.isPrivate) {
        const channelMembership =
          await this.databaseService.channelMembership.findFirst({
            where: { userId, channelId: dto.targetChannelId },
          });
        if (!channelMembership) {
          throw new ForbiddenException(
            'You do not have access to this private channel',
          );
        }
      }
    }

    if (dto.destination === 'dm' && dto.targetDirectMessageGroupId) {
      const dmMember =
        await this.databaseService.directMessageGroupMember.findFirst({
          where: { groupId: dto.targetDirectMessageGroupId, userId },
        });
      if (!dmMember) {
        throw new ForbiddenException(
          'You are not a member of the target DM group',
        );
      }
    }

    if (dto.destination === 'channel' || dto.destination === 'dm') {
      const sizeMB = Math.round(stats.size / 1024 / 1024);

      // Delegate message creation + broadcast to the messages module via a
      // domain event (avoids importing MessagesModule, which would create a
      // circular module dependency).
      const eventPayload: ClipMessageCreateEvent = {
        authorId: userId,
        fileId: file.id,
        durationSeconds: actualDurationSeconds,
        sizeMB,
        destination: dto.destination,
        targetChannelId: dto.targetChannelId,
        targetDirectMessageGroupId: dto.targetDirectMessageGroupId,
      };

      this.logger.log(`Requesting clip message for file: ${file.id}`);
      ({ messageId } = await emitClipMessageCreate(
        this.eventEmitter,
        eventPayload,
      ));

      this.logger.log(
        `Posted replay clip message ${messageId} to ${dto.destination}`,
      );
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
   * Generate a thumbnail for a replay clip and persist its path.
   * Errors are logged but never propagate to the capture response.
   */
  private async generateThumbnail(
    filePath: string,
    fileId: string,
  ): Promise<void> {
    try {
      const thumbnailPath = await this.thumbnailService.generateVideoThumbnail(
        filePath,
        fileId,
      );
      if (thumbnailPath) {
        await this.databaseService.file.update({
          where: { id: fileId },
          data: { thumbnailPath },
        });
        this.logger.log(`Generated thumbnail for replay clip ${fileId}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to generate thumbnail for replay clip ${fileId}: ${getErrorMessage(error)}`,
      );
    }
  }

  /**
   * Calculate appropriate video bitrate based on resolution
   * Screen sharing content (text, UI) needs higher bitrates than camera video
   * for sharp, readable output.
   *
   * Bitrate recommendations for screen content (H.264):
   * - 720p (1280x720): 4-5 Mbps
   * - 1080p (1920x1080): 6-8 Mbps
   * - 1440p (2560x1440): 10-12 Mbps
   * - 4K (3840x2160): 15-20 Mbps
   *
   * @param width - Video width in pixels
   * @param height - Video height in pixels
   * @returns Bitrate in bits per second
   */
  private calculateVideoBitrate(width: number, height: number): number {
    const pixels = width * height;

    // Base calculation: ~5 bits per pixel for screen content at 30fps
    // This is higher than typical camera video (~2-3 bpp) due to
    // sharp edges, text, and high-contrast UI elements
    const bitsPerPixel = 5;
    const baseBitrate = pixels * bitsPerPixel;

    // Apply minimum and maximum bounds
    const minBitrate = 3_000_000; // 3 Mbps minimum (decent 720p)
    const maxBitrate = 20_000_000; // 20 Mbps maximum (high quality 4K)

    const bitrate = Math.max(minBitrate, Math.min(maxBitrate, baseBitrate));

    this.logger.debug(
      `Calculated bitrate for ${width}x${height}: ${bitrate / 1_000_000} Mbps`,
    );

    return bitrate;
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
    const completeSegments =
      await this.replaySegmentsService.listCompleteSegments(segmentDir);

    if (completeSegments.length === 0) {
      return {
        hasActiveSession: true,
        sessionId: session.id,
        totalSegments: 0,
        totalDurationSeconds: 0,
      };
    }

    const totalDurationSeconds = completeSegments.length * 10; // Each segment is ~10 seconds

    return {
      hasActiveSession: true,
      sessionId: session.id,
      totalSegments: completeSegments.length,
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
    const completeSegments =
      await this.replaySegmentsService.listCompleteSegments(segmentDir);

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
   * Get a remuxed segment file path for HLS.js compatibility.
   * Delegates to ReplaySegmentsService (segment lifecycle lives there).
   *
   * @param userId - ID of the user
   * @param segmentFile - Filename of the segment
   * @returns Full path to the remuxed segment file
   */
  async getRemuxedSegmentPath(
    userId: string,
    segmentFile: string,
  ): Promise<string> {
    return this.replaySegmentsService.getRemuxedSegmentPath(
      userId,
      segmentFile,
    );
  }
}

// Clip library methods (getUserClips, getPublicClips, updateClip, deleteClip, shareClip)
// have been extracted to ClipLibraryService for better separation of concerns.
