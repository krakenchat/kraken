# Replay Buffer - Implementation Guide

This guide provides step-by-step instructions for implementing the replay buffer feature from scratch.

## Prerequisites

Before starting implementation:

- ✅ Kraken development environment set up with Docker
- ✅ Familiarity with NestJS, Prisma, React, and Redux
- ✅ LiveKit integration already working (voice/video calls)
- ✅ Understanding of the architecture (read `architecture.md`)

## Phase 1: Infrastructure Setup (2 days)

### Step 1.1: Docker Volume Configuration

**Goal**: Set up shared storage volume for replay buffer segments

**1. Update `docker-compose.yml`:**

```yaml
version: '3.8'

services:
  livekit:
    image: livekit/livekit-server:latest
    volumes:
      - replay-storage:/livekit-storage
    environment:
      - LIVEKIT_STORAGE_PATH=/livekit-storage/replay-buffer

  backend:
    build: ./backend
    volumes:
      - replay-storage:/app/storage
    environment:
      - FILE_UPLOAD_DEST=/app/storage/uploads
      - REPLAY_BUFFER_PATH=/app/storage/replay-buffer
      - REPLAY_STORAGE_PATH=/app/storage/replays

volumes:
  replay-storage:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${REPLAY_STORAGE_PATH:-./storage}  # User-configurable mount
```

**2. Create `.env` file (or update existing):**

```bash
# Replay buffer configuration
REPLAY_STORAGE_PATH=./storage  # Change to NFS mount if desired
REPLAY_BUFFER_DURATION_MINUTES=10
REPLAY_CLEANUP_BUFFER_MINUTES=12
DEFAULT_USER_REPLAY_QUOTA_GB=5
```

**3. Create storage directories:**

```bash
docker compose run --rm backend mkdir -p /app/storage/replay-buffer
docker compose run --rm backend mkdir -p /app/storage/replays
docker compose run --rm backend chmod -R 777 /app/storage  # For development
```

**4. Test volume mount:**

```bash
docker compose up -d
docker compose exec backend ls -la /app/storage
docker compose exec livekit ls -la /livekit-storage
```

Expected output: Both containers should see the same mounted storage.

### Step 1.2: Environment Variables

**1. Update `backend/env.sample`:**

```bash
# ... existing vars

# Replay Buffer Configuration
FILE_UPLOAD_DEST=./uploads
REPLAY_BUFFER_PATH=${FILE_UPLOAD_DEST}/replay-buffer
REPLAY_STORAGE_PATH=${FILE_UPLOAD_DEST}/replays

# Optional: Replay buffer settings
REPLAY_BUFFER_DURATION_MINUTES=10
REPLAY_SEGMENT_DURATION_SECONDS=10
REPLAY_CLEANUP_BUFFER_MINUTES=12
DEFAULT_USER_REPLAY_QUOTA_GB=5
```

**2. Update `backend/src/config/configuration.ts` (if using ConfigModule):**

```typescript
export default () => ({
  // ... existing config

  replayBuffer: {
    bufferDurationMinutes: parseInt(process.env.REPLAY_BUFFER_DURATION_MINUTES || '10', 10),
    segmentDurationSeconds: parseInt(process.env.REPLAY_SEGMENT_DURATION_SECONDS || '10', 10),
    cleanupBufferMinutes: parseInt(process.env.REPLAY_CLEANUP_BUFFER_MINUTES || '12', 10),
    defaultUserQuotaGB: parseInt(process.env.DEFAULT_USER_REPLAY_QUOTA_GB || '5', 10),
    bufferPath: process.env.REPLAY_BUFFER_PATH || './replay-buffer',
    storagePath: process.env.REPLAY_STORAGE_PATH || './replays',
  },
});
```

### Step 1.3: Prisma Schema Updates

**1. Update `backend/prisma/schema.prisma`:**

```prisma
// Add to existing enums
enum ResourceType {
  MESSAGE_ATTACHMENT
  USER_AVATAR
  USER_BANNER
  COMMUNITY_ICON
  COMMUNITY_BANNER
  CHANNEL_ATTACHMENT
  REPLAY_CLIP          // New
}

// Add new models at the end of schema
model EgressSession {
  id          String    @id @default(auto()) @map("_id") @db.ObjectId
  egressId    String    @unique  // LiveKit egress ID
  userId      String    @db.ObjectId
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  communityId String?   @db.ObjectId
  community   Community? @relation(fields: [communityId], references: [id], onDelete: Cascade)
  roomName    String    // LiveKit room name (matches channel ID)
  quality     String    // "720p", "1080p", "1440p"
  status      String    // "active", "stopped", "failed"
  segmentPath String    // /replay-buffer/{room}/{user}/
  startedAt   DateTime
  endedAt     DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([userId, status])
  @@index([roomName, status])
  @@index([status, endedAt])
}

model ReplayClip {
  id              String    @id @default(auto()) @map("_id") @db.ObjectId
  userId          String    @db.ObjectId
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  communityId     String?   @db.ObjectId
  community       Community? @relation(fields: [communityId], references: [id], onDelete: SetNull)
  roomName        String    // For context (which channel)
  durationSeconds Int       // Actual duration (may be +10s from request)
  fileId          String    @db.ObjectId
  file            File      @relation(fields: [fileId], references: [id], onDelete: Cascade)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([userId, createdAt])
  @@index([communityId, createdAt])
}

model CommunityReplayConfig {
  id            String    @id @default(auto()) @map("_id") @db.ObjectId
  communityId   String    @unique @db.ObjectId
  community     Community @relation(fields: [communityId], references: [id], onDelete: Cascade)
  maxConcurrent Int       @default(5)   // Max simultaneous replay buffers
  enabled       Boolean   @default(true) // Feature toggle
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model UserReplayQuota {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  userId     String   @unique @db.ObjectId
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  quotaBytes BigInt   @default(5368709120)  // 5GB default
  usedBytes  BigInt   @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

// Add to User model
model User {
  // ... existing fields
  egressSessions     EgressSession[]
  replayClips        ReplayClip[]
  replayQuota        UserReplayQuota?
}

// Add to Community model
model Community {
  // ... existing fields
  egressSessions     EgressSession[]
  replayClips        ReplayClip[]
  replayConfig       CommunityReplayConfig?
}

// Add to File model
model File {
  // ... existing fields
  replayClips        ReplayClip[]
}
```

**2. Generate and push schema:**

```bash
docker compose run backend npm run prisma:generate
docker compose run backend npm run prisma:push
```

**3. Verify schema update:**

```bash
docker compose run backend npx prisma studio
```

Check that new models appear in Prisma Studio.

### Step 1.4: Add FFmpeg to Backend Dockerfile

**1. Update `backend/Dockerfile`:**

```dockerfile
FROM node:18-alpine AS base

# Install FFmpeg
RUN apk add --no-cache ffmpeg

# ... rest of Dockerfile
```

**2. Rebuild backend:**

```bash
docker-compose build backend --no-cache
docker-compose up -d backend
```

**3. Verify FFmpeg installation:**

```bash
docker compose exec backend ffmpeg -version
```

### Step 1.5: Install NPM Dependencies

**1. Add fluent-ffmpeg:**

```bash
docker compose run backend npm install fluent-ffmpeg
docker compose run backend npm install --save-dev @types/fluent-ffmpeg
```

**2. Verify `package.json` updated:**

```json
{
  "dependencies": {
    // ... existing
    "fluent-ffmpeg": "^2.1.2"
  },
  "devDependencies": {
    // ... existing
    "@types/fluent-ffmpeg": "^2.1.21"
  }
}
```

---

## Phase 2: Backend Service Implementation (3-4 days)

### Step 2.1: Create LivekitReplay Module

**1. Generate module, service, and controller:**

```bash
docker compose run backend npx nest g module livekit-replay
docker compose run backend npx nest g service livekit-replay
docker compose run backend npx nest g controller livekit-replay
```

**2. Update `backend/src/livekit-replay/livekit-replay.module.ts`:**

```typescript
import { Module } from '@nestjs/common';
import { LivekitReplayService } from './livekit-replay.service';
import { LivekitReplayController } from './livekit-replay.controller';
import { DatabaseModule } from '@/database/database.module';
import { LivekitModule } from '@/livekit/livekit.module';
import { FileModule } from '@/file/file.module';
import { FileUploadModule } from '@/file-upload/file-upload.module';
import { MessagesModule } from '@/messages/messages.module';

@Module({
  imports: [
    DatabaseModule,
    LivekitModule,
    FileModule,
    FileUploadModule,
    MessagesModule,
  ],
  controllers: [LivekitReplayController],
  providers: [LivekitReplayService],
  exports: [LivekitReplayService],
})
export class LivekitReplayModule {}
```

### Step 2.2: Implement LivekitReplayService (Core Logic)

**File**: `backend/src/livekit-replay/livekit-replay.service.ts`

```typescript
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '@/database/database.service';
import { ConfigService } from '@nestjs/config';
import {
  EgressClient,
  SegmentedFileOutput,
  EncodingOptionsPreset,
  EncodingOptions,
  VideoCodec,
  AudioCodec,
} from 'livekit-server-sdk';
import * as ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import { createReadStream, createWriteStream } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { v4 as uuid } from 'uuid';
import { createHash } from 'crypto';

@Injectable()
export class LivekitReplayService {
  private readonly logger = new Logger(LivekitReplayService.name);
  private egressClient: EgressClient;
  private readonly bufferPath: string;
  private readonly storagePath: string;
  private readonly bufferDurationMinutes: number;
  private readonly cleanupBufferMinutes: number;
  private readonly segmentDurationSeconds: number;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {
    // Initialize LiveKit Egress client
    this.egressClient = new EgressClient(
      this.configService.get('LIVEKIT_URL'),
      this.configService.get('LIVEKIT_API_KEY'),
      this.configService.get('LIVEKIT_API_SECRET'),
    );

    // Load configuration
    this.bufferPath = this.configService.get('REPLAY_BUFFER_PATH') || '/app/storage/replay-buffer';
    this.storagePath = this.configService.get('REPLAY_STORAGE_PATH') || '/app/storage/replays';
    this.bufferDurationMinutes = parseInt(this.configService.get('REPLAY_BUFFER_DURATION_MINUTES') || '10', 10);
    this.cleanupBufferMinutes = parseInt(this.configService.get('REPLAY_CLEANUP_BUFFER_MINUTES') || '12', 10);
    this.segmentDurationSeconds = parseInt(this.configService.get('REPLAY_SEGMENT_DURATION_SECONDS') || '10', 10);
  }

  /**
   * Start replay buffer for screen share using Track Composite Egress
   *
   * NOTE: Requires videoTrackId (and optionally audioTrackId) which must be
   * obtained from the frontend when screen share track is published.
   */
  async startReplayBuffer(
    roomName: string,
    userId: string,
    videoTrackId: string,        // Screen share video track SID
    audioTrackId: string | null,  // Screen share audio track SID (optional)
    communityId: string | null,
    quality: '720p' | '1080p' | '1440p' = '1080p',
  ) {
    this.logger.log(`Starting replay buffer for user ${userId} in room ${roomName}`);

    // Check if user already has active session
    const existingSession = await this.databaseService.egressSession.findFirst({
      where: { userId, status: 'active' },
    });

    if (existingSession) {
      throw new BadRequestException('User already has an active replay buffer');
    }

    // Create segment path
    const segmentPath = path.join(this.bufferPath, roomName, userId);
    await fs.mkdir(segmentPath, { recursive: true });

    // Configure encoding
    const encodingConfig = this.getEncodingConfig(quality);

    // Configure segmented output
    const segmentedFileOutput = new SegmentedFileOutput({
      filenamePrefix: `${segmentPath}/segment`,
      playlistName: 'full.m3u8',
      livePlaylistName: 'live.m3u8',
      segmentDuration: this.segmentDurationSeconds,
      filenameSuffix: 'TIMESTAMP',
    });

    // Start Track Composite egress (SDK-only, NO Chrome)
    const egressInfo = await this.egressClient.startTrackCompositeEgress({
      roomName,
      videoTrackId,              // Specific screen share video track
      audioTrackId: audioTrackId || undefined,  // Screen share audio (optional)
      ...encodingConfig,
      segmentedFileOutputs: [segmentedFileOutput],
    });

    // Store session in database
    const session = await this.databaseService.egressSession.create({
      data: {
        egressId: egressInfo.egressId,
        userId,
        communityId,
        roomName,
        quality,
        status: 'active',
        segmentPath,
        startedAt: new Date(),
      },
    });

    this.logger.log(`Replay buffer started: ${session.egressId}`);
    return session;
  }

  /**
   * Stop replay buffer
   */
  async stopReplayBuffer(sessionId: string) {
    const session = await this.databaseService.egressSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Egress session not found');
    }

    if (session.status !== 'active') {
      throw new BadRequestException('Session is not active');
    }

    // Stop LiveKit egress
    await this.egressClient.stopEgress(session.egressId);

    // Update session status
    await this.databaseService.egressSession.update({
      where: { id: sessionId },
      data: { status: 'stopped', endedAt: new Date() },
    });

    // Schedule segment cleanup (cleanup all segments after stop)
    await this.cleanupAllSegments(session.segmentPath);

    this.logger.log(`Replay buffer stopped: ${session.egressId}`);
  }

  /**
   * Capture replay from last N minutes
   */
  async captureReplay(options: {
    sessionId: string;
    durationMinutes: 1 | 2 | 5 | 10;
    userId: string;
  }) {
    const session = await this.databaseService.egressSession.findUnique({
      where: { id: options.sessionId },
    });

    if (!session) {
      throw new NotFoundException('Egress session not found');
    }

    if (session.userId !== options.userId) {
      throw new BadRequestException('Session does not belong to user');
    }

    const endTime = Date.now();
    const startTime = endTime - (options.durationMinutes * 60 * 1000);

    // List segments in time range
    const segments = await this.listSegmentsInRange(session.segmentPath, startTime, endTime);

    if (segments.length === 0) {
      throw new BadRequestException('No segments found in specified time range');
    }

    this.logger.log(`Capturing ${segments.length} segments for ${options.durationMinutes} minutes`);

    // Create temp directory
    const tempDir = path.join(tmpdir(), `replay-${uuid()}`);
    await fs.mkdir(tempDir, { recursive: true });

    try {
      // Download/copy segments to temp dir
      const segmentPaths = await Promise.all(
        segments.map((seg, idx) => this.copySegment(seg, path.join(tempDir, `seg${idx}.ts`))),
      );

      // Concatenate with FFmpeg
      const outputPath = path.join(tempDir, 'replay.mp4');
      await this.concatenateSegments(segmentPaths, outputPath);

      // Get file stats
      const stats = await fs.stat(outputPath);
      const actualDuration = segments.length * this.segmentDurationSeconds;

      // Move to permanent storage
      const replayFilename = `replay-${Date.now()}.mp4`;
      const permanentDir = path.join(this.storagePath, session.userId);
      await fs.mkdir(permanentDir, { recursive: true });
      const permanentPath = path.join(permanentDir, replayFilename);
      await fs.rename(outputPath, permanentPath);

      // Generate checksum
      const checksum = await this.generateChecksum(permanentPath);

      // Create File record
      const fileRecord = await this.databaseService.file.create({
        data: {
          filename: replayFilename,
          mimeType: 'video/mp4',
          fileType: 'VIDEO',
          size: stats.size,
          checksum,
          uploadedById: session.userId,
          storageType: 'LOCAL',
          storagePath: permanentPath,
          resourceType: 'REPLAY_CLIP',
        },
      });

      // Create ReplayClip record
      const replayClip = await this.databaseService.replayClip.create({
        data: {
          userId: session.userId,
          communityId: session.communityId,
          roomName: session.roomName,
          durationSeconds: actualDuration,
          fileId: fileRecord.id,
        },
      });

      // Update user quota
      await this.updateUserQuota(session.userId, stats.size);

      // Cleanup temp directory
      await fs.rm(tempDir, { recursive: true, force: true });

      this.logger.log(`Replay captured: ${replayClip.id}, size: ${stats.size} bytes`);

      return {
        clipId: replayClip.id,
        fileId: fileRecord.id,
        durationSeconds: actualDuration,
        sizeBytes: stats.size,
      };
    } catch (error) {
      // Cleanup temp directory on error
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
  }

  /**
   * Cleanup segments older than buffer duration
   * Runs every 5 minutes
   */
  @Cron('*/5 * * * *')
  async cleanupOldSegments() {
    this.logger.debug('Running cleanup of old replay buffer segments...');

    const activeSessions = await this.databaseService.egressSession.findMany({
      where: { status: 'active' },
    });

    const cutoffTime = Date.now() - (this.cleanupBufferMinutes * 60 * 1000);
    let totalDeleted = 0;

    for (const session of activeSessions) {
      try {
        const files = await fs.readdir(session.segmentPath);
        const segmentFiles = files.filter(f => f.startsWith('segment-') && f.endsWith('.ts'));

        for (const file of segmentFiles) {
          const timestamp = this.extractTimestampFromFilename(file);
          if (timestamp && timestamp < cutoffTime) {
            await fs.unlink(path.join(session.segmentPath, file));
            totalDeleted++;
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to cleanup segments for session ${session.id}:`, error);
      }
    }

    if (totalDeleted > 0) {
      this.logger.log(`Cleaned up ${totalDeleted} old segments`);
    }
  }

  /**
   * Cleanup orphaned egress sessions
   * Runs every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOrphanedSessions() {
    this.logger.debug('Running cleanup of orphaned egress sessions...');

    // Find sessions active for more than 3 hours (likely orphaned)
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const orphanedSessions = await this.databaseService.egressSession.findMany({
      where: {
        status: 'active',
        startedAt: { lt: threeHoursAgo },
      },
    });

    for (const session of orphanedSessions) {
      try {
        await this.egressClient.stopEgress(session.egressId);
        await this.databaseService.egressSession.update({
          where: { id: session.id },
          data: { status: 'stopped', endedAt: new Date() },
        });
        await this.cleanupAllSegments(session.segmentPath);
        this.logger.warn(`Cleaned up orphaned session: ${session.egressId}`);
      } catch (error) {
        this.logger.error(`Failed to cleanup orphaned session ${session.id}:`, error);
      }
    }
  }

  // --- Helper Methods ---

  private getEncodingConfig(quality: string) {
    const presets = {
      '720p': { preset: EncodingOptionsPreset.H264_720P_30 },
      '1080p': { preset: EncodingOptionsPreset.H264_1080P_60 },
      '1440p': {
        advanced: new EncodingOptions({
          width: 2560,
          height: 1440,
          framerate: 30,
          videoBitrate: 8000,
          videoCodec: VideoCodec.H264_HIGH,
          audioBitrate: 128,
          audioCodec: AudioCodec.OPUS,
        }),
      },
    };

    return presets[quality] || presets['1080p'];
  }

  private async listSegmentsInRange(segmentPath: string, startTime: number, endTime: number) {
    const files = await fs.readdir(segmentPath);
    const segmentFiles = files.filter(f => f.startsWith('segment-') && f.endsWith('.ts'));

    return segmentFiles
      .map(file => ({
        filename: file,
        path: path.join(segmentPath, file),
        timestamp: this.extractTimestampFromFilename(file),
      }))
      .filter(seg => seg.timestamp && seg.timestamp >= startTime && seg.timestamp <= endTime)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(seg => seg.path);
  }

  private extractTimestampFromFilename(filename: string): number | null {
    const match = filename.match(/segment-(\d+)\.ts$/);
    return match ? parseInt(match[1]) : null;
  }

  private async copySegment(sourcePath: string, destPath: string): Promise<string> {
    await fs.copyFile(sourcePath, destPath);
    return destPath;
  }

  private async concatenateSegments(segmentPaths: string[], outputPath: string): Promise<void> {
    const concatFile = path.join(path.dirname(outputPath), `concat-${uuid()}.txt`);
    const fileList = segmentPaths.map(p => `file '${p}'`).join('\n');
    await fs.writeFile(concatFile, fileList);

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(concatFile)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions(['-c copy', '-movflags +faststart'])
        .output(outputPath)
        .on('end', async () => {
          await fs.unlink(concatFile).catch(() => {});
          resolve();
        })
        .on('error', async (err) => {
          await fs.unlink(concatFile).catch(() => {});
          reject(err);
        })
        .run();
    });
  }

  private async generateChecksum(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    return createHash('sha256').update(fileBuffer).digest('hex');
  }

  private async cleanupAllSegments(segmentPath: string) {
    try {
      await fs.rm(segmentPath, { recursive: true, force: true });
      this.logger.debug(`Cleaned up all segments at ${segmentPath}`);
    } catch (error) {
      this.logger.warn(`Failed to cleanup segments at ${segmentPath}:`, error);
    }
  }

  private async updateUserQuota(userId: string, sizeBytes: number) {
    await this.databaseService.userReplayQuota.upsert({
      where: { userId },
      create: {
        userId,
        quotaBytes: 5368709120, // 5GB default
        usedBytes: sizeBytes,
      },
      update: {
        usedBytes: { increment: sizeBytes },
      },
    });
  }
}
```

### Step 2.3: Create DTOs

**File**: `backend/src/livekit-replay/dto/start-replay-buffer.dto.ts`

```typescript
import { IsString, IsEnum, IsOptional, IsMongoId } from 'class-validator';

export class StartReplayBufferDto {
  @IsString()
  roomName: string;

  @IsString()
  videoTrackId: string;  // Screen share video track SID from LiveKit

  @IsOptional()
  @IsString()
  audioTrackId?: string;  // Screen share audio track SID (optional)

  @IsOptional()
  @IsMongoId()
  communityId?: string;

  @IsOptional()
  @IsEnum(['720p', '1080p', '1440p'])
  quality?: '720p' | '1080p' | '1440p';
}
```

**Note**: The frontend must detect published screen share tracks and send their SIDs. See Phase 5 (frontend-components.md) for track detection implementation.

**File**: `backend/src/livekit-replay/dto/capture-replay.dto.ts`

```typescript
import { IsMongoId, IsEnum, IsOptional } from 'class-validator';

export class CaptureReplayDto {
  @IsMongoId()
  sessionId: string;

  @IsEnum([1, 2, 5, 10])
  durationMinutes: 1 | 2 | 5 | 10;

  @IsOptional()
  @IsEnum(['dm', 'channel'])
  shareOption?: 'dm' | 'channel';

  @IsOptional()
  @IsMongoId()
  targetChannelId?: string;
}
```

### Step 2.4: Implement Controller

**File**: `backend/src/livekit-replay/livekit-replay.controller.ts`

```typescript
import { Controller, Post, Get, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { LivekitReplayService } from './livekit-replay.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { AuthenticatedRequest } from '@/types';
import { ParseObjectIdPipe } from 'nestjs-object-id';
import { StartReplayBufferDto } from './dto/start-replay-buffer.dto';
import { CaptureReplayDto } from './dto/capture-replay.dto';

@UseGuards(JwtAuthGuard)
@Controller('livekit-replay')
export class LivekitReplayController {
  constructor(private readonly livekitReplayService: LivekitReplayService) {}

  @Post('start')
  async startReplayBuffer(
    @Body() dto: StartReplayBufferDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.livekitReplayService.startReplayBuffer(
      dto.roomName,
      req.user.id,
      dto.videoTrackId,           // Screen share video track SID
      dto.audioTrackId || null,   // Screen share audio track SID (optional)
      dto.communityId || null,
      dto.quality || '1080p',
    );
  }

  @Post('stop/:sessionId')
  async stopReplayBuffer(
    @Param('sessionId', ParseObjectIdPipe) sessionId: string,
  ) {
    return this.livekitReplayService.stopReplayBuffer(sessionId);
  }

  @Post('capture')
  async captureReplay(
    @Body() dto: CaptureReplayDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.livekitReplayService.captureReplay({
      sessionId: dto.sessionId,
      durationMinutes: dto.durationMinutes,
      userId: req.user.id,
    });
  }

  @Get('status/:roomName')
  async getStatus(@Param('roomName') roomName: string) {
    // Return active sessions in room
    return this.livekitReplayService.getActiveSessions(roomName);
  }

  @Get('my-clips')
  async getMyClips(@Req() req: AuthenticatedRequest) {
    return this.livekitReplayService.getUserClips(req.user.id);
  }

  @Delete('clips/:id')
  async deleteClip(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.livekitReplayService.deleteClip(id, req.user.id);
  }
}
```

(Add corresponding methods to service)

---

## Phase 3-7: Continued in Separate Sections

Due to length, the remaining phases are documented in separate files:

- **Phase 3**: Access Control & RBAC → See `api-reference.md`
- **Phase 4**: API Endpoints → See `api-reference.md`
- **Phase 5**: Frontend UI → See `frontend-components.md`
- **Phase 6**: Background Jobs → Covered in Step 2.2 above
- **Phase 7**: Testing → See `testing-guide.md`

## Next Steps

1. **Test Backend**: Use Postman/curl to test endpoints
2. **Implement Frontend**: Follow `frontend-components.md`
3. **Write Tests**: Follow `testing-guide.md`
4. **Deploy**: Follow `deployment.md`

## Common Issues During Implementation

See `troubleshooting.md` for solutions to common problems encountered during implementation.
