# Replay Buffer - Testing Guide

Comprehensive testing strategy for replay buffer feature.

## Unit Tests (@suites/unit with Automocks)

### LivekitReplayService Tests

**File**: `backend/src/livekit-replay/livekit-replay.service.spec.ts`

```typescript
import { TestBed } from '@suites/unit';
import { LivekitReplayService } from './livekit-replay.service';
import { DatabaseService } from '@/database/database.service';
import { ConfigService } from '@nestjs/config';
import { RoomServiceClient } from 'livekit-server-sdk';

describe('LivekitReplayService', () => {
  let service: LivekitReplayService;
  let databaseService: DatabaseService;
  let livekitClient: RoomServiceClient;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(LivekitReplayService).compile();

    service = unit;
    databaseService = unitRef.get(DatabaseService);
    livekitClient = unitRef.get(RoomServiceClient);
  });

  describe('startReplayBuffer', () => {
    it('should start replay buffer with correct config', async () => {
      const mockSession = {
        id: 'session-id',
        egressId: 'egress-123',
        userId: 'user-id',
        roomName: 'room-123',
        status: 'active',
      };

      databaseService.egressSession.findFirst = jest.fn().mockResolvedValue(null);
      databaseService.egressSession.create = jest.fn().mockResolvedValue(mockSession);
      livekitClient.startParticipantEgress = jest.fn().mockResolvedValue({
        egressId: 'egress-123',
      });

      const result = await service.startReplayBuffer('room-123', 'user-id', null, '1080p');

      expect(livekitClient.startParticipantEgress).toHaveBeenCalledWith(
        expect.objectContaining({
          roomName: 'room-123',
          identity: 'user-id',
          screenShare: true,
        })
      );
      expect(result).toEqual(mockSession);
    });

    it('should throw error if user already has active buffer', async () => {
      databaseService.egressSession.findFirst = jest.fn().mockResolvedValue({
        id: 'existing',
        status: 'active',
      });

      await expect(
        service.startReplayBuffer('room-123', 'user-id', null, '1080p')
      ).rejects.toThrow('User already has an active replay buffer');
    });
  });

  describe('captureReplay', () => {
    it('should capture replay and create file record', async () => {
      const mockSession = {
        id: 'session-id',
        userId: 'user-id',
        segmentPath: '/tmp/replay-buffer/room/user',
      };

      const mockClip = {
        id: 'clip-id',
        fileId: 'file-id',
        durationSeconds: 300,
      };

      databaseService.egressSession.findUnique = jest.fn().mockResolvedValue(mockSession);
      databaseService.replayClip.create = jest.fn().mockResolvedValue(mockClip);
      databaseService.file.create = jest.fn().mockResolvedValue({ id: 'file-id', size: 1000000 });

      // Mock filesystem and FFmpeg operations
      jest.spyOn(service as any, 'listSegmentsInRange').mockResolvedValue([
        '/tmp/seg1.ts',
        '/tmp/seg2.ts',
      ]);
      jest.spyOn(service as any, 'concatenateSegments').mockResolvedValue(undefined);

      const result = await service.captureReplay({
        sessionId: 'session-id',
        durationMinutes: 5,
        userId: 'user-id',
      });

      expect(result).toHaveProperty('clipId');
      expect(result).toHaveProperty('fileId');
    });
  });

  describe('cleanupOldSegments', () => {
    it('should delete segments older than buffer duration', async () => {
      const mockSessions = [
        { id: 'session-1', segmentPath: '/tmp/buffer/session-1' },
      ];

      databaseService.egressSession.findMany = jest.fn().mockResolvedValue(mockSessions);

      // Mock filesystem operations
      const unlinkSpy = jest.spyOn(fs, 'unlink').mockResolvedValue(undefined);

      await service.cleanupOldSegments();

      // Verify old segments were deleted
      expect(unlinkSpy).toHaveBeenCalled();
    });
  });
});
```

### LivekitReplayController Tests

**File**: `backend/src/livekit-replay/livekit-replay.controller.spec.ts`

```typescript
import { TestBed } from '@suites/unit';
import { LivekitReplayController } from './livekit-replay.controller';
import { LivekitReplayService } from './livekit-replay.service';

describe('LivekitReplayController', () => {
  let controller: LivekitReplayController;
  let service: LivekitReplayService;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(LivekitReplayController).compile();

    controller = unit;
    service = unitRef.get(LivekitReplayService);
  });

  describe('startReplayBuffer', () => {
    it('should call service.startReplayBuffer with correct params', async () => {
      const mockRequest = { user: { id: 'user-id' } };
      const dto = { roomName: 'room-123', quality: '1080p' as const };

      service.startReplayBuffer = jest.fn().mockResolvedValue({ id: 'session-id' });

      await controller.startReplayBuffer(dto, mockRequest as any);

      expect(service.startReplayBuffer).toHaveBeenCalledWith('room-123', 'user-id', null, '1080p');
    });
  });
});
```

---

## E2E Tests

### Full Replay Buffer Workflow

**File**: `backend/test/livekit-replay.e2e-spec.ts`

```typescript
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { DatabaseService } from '@/database/database.service';

describe('Replay Buffer E2E', () => {
  let app: INestApplication;
  let databaseService: DatabaseService;
  let authToken: string;
  let userId: string;
  let sessionId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    databaseService = app.get(DatabaseService);

    // Create test user and authenticate
    const user = await databaseService.user.create({
      data: { username: 'testuser', email: 'test@example.com', password: 'hashed' },
    });
    userId = user.id;

    // Get auth token (implement based on your auth system)
    authToken = await getAuthToken(app, 'testuser', 'password');
  });

  afterAll(async () => {
    // Cleanup
    await databaseService.user.delete({ where: { id: userId } });
    await app.close();
  });

  it('should complete full replay buffer workflow', async () => {
    // 1. Start replay buffer
    const startRes = await request(app.getHttpServer())
      .post('/livekit-replay/start')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        roomName: 'test-room',
        quality: '1080p',
      })
      .expect(201);

    expect(startRes.body).toHaveProperty('egressId');
    sessionId = startRes.body.id;

    // 2. Verify session is active
    const statusRes = await request(app.getHttpServer())
      .get('/livekit-replay/status/test-room')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(statusRes.body.activeSessions).toHaveLength(1);

    // 3. Simulate segment creation (for testing, manually create segments)
    // In production, LiveKit creates segments

    // 4. Capture replay
    const captureRes = await request(app.getHttpServer())
      .post('/livekit-replay/capture')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        sessionId,
        durationMinutes: 1,
      })
      .expect(201);

    expect(captureRes.body).toHaveProperty('clipId');
    expect(captureRes.body).toHaveProperty('fileId');

    // 5. Verify clip exists in "my clips"
    const clipsRes = await request(app.getHttpServer())
      .get('/livekit-replay/my-clips')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(clipsRes.body.clips).toHaveLength(1);

    // 6. Delete clip
    await request(app.getHttpServer())
      .delete(`/livekit-replay/clips/${captureRes.body.clipId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    // 7. Stop replay buffer
    await request(app.getHttpServer())
      .post(`/livekit-replay/stop/${sessionId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
  });

  it('should enforce community concurrent limit', async () => {
    // Create community with limit of 1
    const community = await databaseService.community.create({
      data: { name: 'Test Community', ownerId: userId },
    });

    await databaseService.communityReplayConfig.create({
      data: { communityId: community.id, maxConcurrent: 1 },
    });

    // Start first buffer (should succeed)
    const res1 = await request(app.getHttpServer())
      .post('/livekit-replay/start')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        roomName: 'room-1',
        communityId: community.id,
      })
      .expect(201);

    // Start second buffer (should fail - limit reached)
    await request(app.getHttpServer())
      .post('/livekit-replay/start')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        roomName: 'room-2',
        communityId: community.id,
      })
      .expect(429);

    // Cleanup
    await databaseService.egressSession.delete({ where: { id: res1.body.id } });
    await databaseService.community.delete({ where: { id: community.id } });
  });

  it('should enforce user storage quota', async () => {
    // Set low quota
    await databaseService.userReplayQuota.create({
      data: {
        userId,
        quotaBytes: 1000, // 1 KB
        usedBytes: 0,
      },
    });

    // Create large clip (mock large file)
    // Should fail with 507 Insufficient Storage
    // (Implementation depends on test setup)
  });
});
```

---

## Integration Tests

### FFmpeg Concatenation Test

```typescript
describe('FFmpeg Integration', () => {
  it('should concatenate segments into MP4', async () => {
    const service = new LivekitReplayService(/* ... */);

    // Create test segments
    const seg1 = '/tmp/test-seg-1.ts';
    const seg2 = '/tmp/test-seg-2.ts';
    const output = '/tmp/test-output.mp4';

    // Create dummy segment files
    await fs.writeFile(seg1, Buffer.from('dummy'));
    await fs.writeFile(seg2, Buffer.from('dummy'));

    // Test concatenation
    await service['concatenateSegments']([seg1, seg2], output);

    // Verify output exists
    const exists = await fs.access(output).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    // Cleanup
    await fs.unlink(seg1);
    await fs.unlink(seg2);
    await fs.unlink(output);
  });
});
```

---

## Manual Testing Checklist

### Setup
- [ ] Docker environment running
- [ ] Storage volumes mounted
- [ ] Database migrations applied
- [ ] Test user created with permissions

### Start Replay Buffer
- [ ] User can enable replay buffer while screen sharing
- [ ] Recording indicator appears on user avatar
- [ ] Segments start appearing in storage directory
- [ ] Session record created in database

### Capture Replay
- [ ] User can select duration (1/2/5/10 min)
- [ ] Capture completes in <5 seconds
- [ ] Replay file created in /replays/
- [ ] File record created in database
- [ ] User quota updated correctly
- [ ] Can download replay file

### Share Replay
- [ ] Can share to DM
- [ ] Can share to channel
- [ ] Replay appears as message attachment
- [ ] Can play video inline

### Stop Replay Buffer
- [ ] User can stop buffer
- [ ] Segments cleaned up
- [ ] Session marked as stopped
- [ ] Recording indicator disappears

### Edge Cases
- [ ] Try to start two buffers (should fail)
- [ ] Capture with no segments (should fail)
- [ ] Capture after segments cleaned (should fail)
- [ ] Delete clip (should free quota)
- [ ] Exceed quota (should fail)
- [ ] Reach community limit (should fail)

### Cleanup Jobs
- [ ] Old segments deleted after 12 minutes
- [ ] Orphaned sessions stopped after 3 hours
- [ ] Check cron logs for errors

---

## Performance Testing

### Load Test Script

```typescript
// test/load/replay-buffer.load.ts
import { performance } from 'perf_hooks';

async function loadTest() {
  const concurrentBuffers = 10;
  const captureDuration = 5; // minutes

  const promises = [];

  for (let i = 0; i < concurrentBuffers; i++) {
    promises.push(testReplayBuffer(i));
  }

  await Promise.all(promises);
}

async function testReplayBuffer(index: number) {
  const start = performance.now();

  // Start buffer
  const session = await startBuffer(`user-${index}`, `room-${index}`);

  // Wait for segments to accumulate (simulate 5 min)
  await sleep(5 * 60 * 1000);

  // Capture replay
  const captureStart = performance.now();
  const clip = await captureReplay(session.id, captureDuration);
  const captureTime = performance.now() - captureStart;

  console.log(`User ${index}: Capture took ${captureTime}ms`);

  // Stop buffer
  await stopBuffer(session.id);

  const total = performance.now() - start;
  console.log(`User ${index}: Total test time ${total}ms`);
}

loadTest();
```

**Expected Results**:
- 10 concurrent buffers: ~7.5 MB/s total write
- Capture time: <5 seconds per clip
- No errors or timeouts

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Replay Buffer Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mongodb:
        image: mongo:6
        ports:
          - 27017:27017

      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install FFmpeg
        run: sudo apt-get install -y ffmpeg

      - name: Run unit tests
        run: npm run test -- --testPathPattern=livekit-replay

      - name: Run E2E tests
        run: npm run test:e2e -- --testPathPattern=livekit-replay

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## Test Coverage Goals

| Component | Target Coverage |
|-----------|----------------|
| LivekitReplayService | >80% |
| LivekitReplayController | >90% |
| DTOs | 100% |
| E2E Workflows | >70% |

**Check Coverage**:
```bash
docker compose run backend npm run test:cov
```

---

**Next Steps**:
- Run all tests before deployment
- Add tests to CI/CD pipeline
- Monitor test failures in production
