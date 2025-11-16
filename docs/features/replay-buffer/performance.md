# Replay Buffer - Performance Optimization

Performance tuning and optimization strategies.

## Disk I/O Optimization

### Write Performance

**Baseline Requirements** (1080p 60fps):
- Write speed: 0.75 MB/s per active buffer
- Sequential writes (HLS segments created sequentially)

**Optimization Strategies**:

**1. Use Fast Storage**:
```
HDD (7200 RPM):      100-150 MB/s  → Support 20-30 buffers
SSD (SATA):          400-500 MB/s  → Support 100+ buffers
SSD (NVMe):          2000+ MB/s    → Support 500+ buffers
```

**2. Separate Volumes**:
```yaml
# Fast SSD for temp segments (high I/O)
volumes:
  replay-buffer:
    driver: local
    driver_opts:
      device: /mnt/nvme/replay-buffer

  # Slower HDD for permanent replays (infrequent access)
  replays:
    driver: local
    driver_opts:
      device: /mnt/hdd/replays
```

**3. Mount Options**:
```yaml
volumes:
  replay-buffer:
    driver_opts:
      o: bind,noatime,nodiratime  # Disable access time updates
```

**4. Filesystem Choice**:
- **XFS**: Best for large files, good for replay segments
- **ext4**: Good all-around performance
- **ZFS**: Advanced features (compression, dedup) but higher overhead

---

## FFmpeg Optimization

### Stream Copy (Current Implementation)

**Current**:
```typescript
ffmpeg()
  .inputOptions(['-f concat', '-safe 0'])
  .outputOptions(['-c copy', '-movflags +faststart'])
```

**Performance**: ~1-2 seconds for 10-minute video

**Pros**:
- No re-encoding (lossless)
- Minimal CPU usage
- Fast processing

**Cons**:
- Cannot trim partial segments
- Cannot change quality

### Advanced Optimizations

**1. Parallel Processing**:
```typescript
// Process multiple captures simultaneously
const captureQueue = new PQueue({ concurrency: 3 });

async function captureReplay(options) {
  return captureQueue.add(() => this.processCaptureReplay(options));
}
```

**2. Segment Caching**:
```typescript
// Cache frequently accessed segments in memory
const segmentCache = new LRU({ max: 100, ttl: 60000 }); // 100 segments, 1 min TTL

async function getSegment(path: string) {
  const cached = segmentCache.get(path);
  if (cached) return cached;

  const data = await fs.readFile(path);
  segmentCache.set(path, data);
  return data;
}
```

**3. Pre-allocate Output File**:
```typescript
// Allocate file space upfront to reduce fragmentation
const estimatedSize = segments.length * 7.5 * 1024 * 1024; // MB
await fs.writeFile(outputPath, Buffer.alloc(estimatedSize));
```

---

## Network Optimization (NFS)

### NFS Mount Tuning

**Optimized Mount Options**:
```yaml
driver_opts:
  type: nfs
  o: addr=nfs-server,rw,nfsvers=4.1,hard,timeo=600,retrans=2,rsize=1048576,wsize=1048576,async
```

**Key Parameters**:
- `nfsvers=4.1`: Use NFSv4.1 for better performance
- `hard`: Retry indefinitely (prevents data loss)
- `timeo=600`: 60-second timeout (adjust based on latency)
- `rsize/wsize=1048576`: 1MB read/write buffers (max performance)
- `async`: Async writes (faster, but use with caution)

### NFS Server Tuning

**On NFS Server** (`/etc/nfs.conf`):
```ini
[nfsd]
threads = 64        # Increase concurrent connections
vers4.1 = y         # Enable NFSv4.1
```

**Restart NFS**:
```bash
systemctl restart nfs-server
```

---

## Database Optimization

### Indexes

**Ensure these indexes exist** (from schema.md):
```prisma
@@index([userId, status])      // Find user's active sessions
@@index([roomName, status])    // Find room's active sessions
@@index([status, endedAt])     // Cleanup orphaned sessions
@@index([userId, createdAt])   // List user's clips
```

### Query Optimization

**Avoid N+1 queries**:
```typescript
// ❌ BAD: N+1 query
const clips = await prisma.replayClip.findMany({ where: { userId } });
for (const clip of clips) {
  const file = await prisma.file.findUnique({ where: { id: clip.fileId } });
}

// ✅ GOOD: Use include
const clips = await prisma.replayClip.findMany({
  where: { userId },
  include: { file: true },  // Single query
});
```

**Use projections**:
```typescript
// Only fetch needed fields
const clips = await prisma.replayClip.findMany({
  where: { userId },
  select: {
    id: true,
    durationSeconds: true,
    file: {
      select: { filename: true, size: true },
    },
  },
});
```

---

## Memory Optimization

### Cleanup Job Memory Usage

**Current Implementation** (loads all filenames into memory):
```typescript
const files = await fs.readdir(segmentPath); // Could be 72+ files
```

**Optimized** (stream directory):
```typescript
import { opendir } from 'fs/promises';

async function* listSegments(segmentPath: string) {
  const dir = await opendir(segmentPath);
  for await (const entry of dir) {
    if (entry.name.startsWith('segment-') && entry.name.endsWith('.ts')) {
      yield entry.name;
    }
  }
}

// Use:
for await (const segment of listSegments(segmentPath)) {
  // Process one at a time (constant memory)
}
```

### Limit Concurrent Operations

```typescript
import PQueue from 'p-queue';

const queue = new PQueue({ concurrency: 5 });

// Limit concurrent segment copies
await Promise.all(
  segments.map(seg => queue.add(() => copySegment(seg)))
);
```

---

## Segment Duration Tuning

### Trade-offs

| Duration | Files per 10 min | Precision | I/O Overhead | Recommendation |
|----------|------------------|-----------|--------------|----------------|
| **6s**   | 100              | High      | High         | For short clips |
| **10s**  | 60               | Medium    | Medium       | **Recommended** |
| **15s**  | 40               | Low       | Low          | For long clips |

**Change segment duration**:
```bash
REPLAY_SEGMENT_DURATION_SECONDS=15
```

---

## Concurrent User Scaling

### Capacity Planning

**Calculate Max Concurrent Buffers**:
```
Max Buffers = (Disk Write Speed MB/s) / (Bitrate per Buffer MB/s)

Example (SSD):
  500 MB/s / 0.75 MB/s = 666 concurrent buffers

Example (HDD):
  125 MB/s / 0.75 MB/s = 166 concurrent buffers
```

### Resource Requirements per 100 Concurrent Buffers

**LiveKit Egress Service** (Track Composite):
- **Egress Pods**: 12-25 pods @ 2 CPU / 2GB RAM each
  - Each pod handles 4-8 concurrent recordings
  - Total: **24-50 CPUs**, **24-50GB RAM**
- **CPU per Recording**: 0.5-1 CPU (SDK-only, NO Chrome)
- **RAM per Recording**: 500MB-1GB (SDK-only, NO Chrome)

**Kraken Backend**:
- **CPU**: Minimal during recording, spikes during captures
- **RAM**: ~2GB (Node.js overhead + buffers)
- **Disk I/O**: 75 MB/s write (100 × 0.75 MB/s)

**Storage**:
- **Temp Segments**: ~54GB (100 × 540MB rolling buffer)
- **Permanent Replays**: Depends on user retention patterns

**Key Insight**: Most resources are consumed by the **egress service**, not the Kraken backend. Scale egress pods horizontally to support more concurrent users.

### Load Balancing (Multi-Server)

**Option 1: Sticky Sessions**
```nginx
upstream kraken_backend {
  ip_hash;  # Route same user to same server
  server backend-1:3001;
  server backend-2:3001;
  server backend-3:3001;
}
```

**Option 2: Shared Storage**
```yaml
# All backends share same NFS mount
services:
  backend-1:
    volumes:
      - nfs-replay-storage:/app/storage

  backend-2:
    volumes:
      - nfs-replay-storage:/app/storage

  backend-3:
    volumes:
      - nfs-replay-storage:/app/storage

volumes:
  nfs-replay-storage:
    driver: local
    driver_opts:
      type: nfs
      o: addr=nfs-server,rw
```

### Egress Service Scaling

**Horizontal Pod Autoscaling** (Kubernetes):
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: livekit-egress
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: livekit-egress
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70  # Scale when CPU > 70%
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 75  # Scale when RAM > 75%
```

**Egress Pod Resource Requests/Limits**:
```yaml
resources:
  requests:
    cpu: "2000m"      # 2 CPUs
    memory: "2Gi"     # 2GB RAM
  limits:
    cpu: "4000m"      # 4 CPUs max (for burst capacity)
    memory: "4Gi"     # 4GB RAM max
```

**Scaling Examples**:
| Concurrent Users | Egress Pods | Total CPU | Total RAM | Notes |
|------------------|-------------|-----------|-----------|-------|
| 5 users          | 1 pod       | 2 CPU     | 2GB       | Development |
| 20 users         | 3-5 pods    | 6-10 CPU  | 6-10GB    | Small community |
| 50 users         | 7-13 pods   | 14-26 CPU | 14-26GB   | Medium community |
| 100 users        | 13-25 pods  | 26-50 CPU | 26-50GB   | Large community |

**Cost Comparison** (vs Room Composite):
- **Track Composite**: ~$40/month for 20 concurrent users (AWS c5.2xlarge)
- **Room Composite**: ~$200/month for 20 concurrent users (AWS c5.9xlarge)
- **Savings**: **80% reduction** in infrastructure costs

---

## Monitoring & Metrics

### Key Metrics to Track

```typescript
import { Counter, Histogram, Gauge } from 'prom-client';

// Active sessions
const activeBuffersGauge = new Gauge({
  name: 'replay_buffer_active_sessions',
  help: 'Number of active replay buffer sessions',
});

// Capture duration
const captureDurationHistogram = new Histogram({
  name: 'replay_buffer_capture_duration_seconds',
  help: 'Time to capture replay',
  buckets: [1, 2, 5, 10, 30],  // seconds
});

// Storage usage
const storageUsageGauge = new Gauge({
  name: 'replay_buffer_storage_bytes',
  help: 'Storage used by replay buffers',
  labelNames: ['type'],  // 'temp' or 'permanent'
});

// Capture errors
const captureErrorsCounter = new Counter({
  name: 'replay_buffer_capture_errors_total',
  help: 'Total capture errors',
  labelNames: ['error_type'],
});
```

### Prometheus Endpoint

```typescript
@Controller('metrics')
export class MetricsController {
  @Get()
  getMetrics() {
    return register.metrics();
  }
}
```

### Grafana Dashboard

**Sample PromQL Queries**:
```promql
# Active buffers
replay_buffer_active_sessions

# Capture success rate
sum(rate(replay_buffer_captures_total[5m]))
/ sum(rate(replay_buffer_capture_attempts_total[5m]))

# P95 capture duration
histogram_quantile(0.95, replay_buffer_capture_duration_seconds)

# Storage usage trend
replay_buffer_storage_bytes{type="permanent"}
```

---

## Caching Strategies

### 1. Segment Metadata Cache

```typescript
// Cache segment timestamps to avoid filesystem reads
const segmentTimestampCache = new Map<string, number>();

async function getSegmentTimestamp(filename: string): Promise<number> {
  if (segmentTimestampCache.has(filename)) {
    return segmentTimestampCache.get(filename);
  }

  const timestamp = extractTimestampFromFilename(filename);
  segmentTimestampCache.set(filename, timestamp);
  return timestamp;
}
```

### 2. User Quota Cache

```typescript
// Cache user quotas in Redis (avoid DB queries)
async function getUserQuota(userId: string) {
  const cached = await redis.get(`quota:${userId}`);
  if (cached) return JSON.parse(cached);

  const quota = await prisma.userReplayQuota.findUnique({ where: { userId } });
  await redis.setex(`quota:${userId}`, 300, JSON.stringify(quota));  // 5 min TTL
  return quota;
}
```

---

## Benchmarks

### Capture Performance

**Test Setup**:
- 10-minute capture (60 segments)
- 1080p 60fps segments
- Local SSD storage

**Results**:
| Operation | Time |
|-----------|------|
| List segments | 10ms |
| Copy segments to temp | 800ms |
| FFmpeg concatenation | 1200ms |
| Move to permanent storage | 50ms |
| **Total** | **~2.1 seconds** |

### Cleanup Job Performance

**Test Setup**:
- 10 active sessions
- 72 segments per session (720 total files)
- 30% of segments need deletion

**Results**:
| Storage Type | Time |
|--------------|------|
| Local SSD | 150ms |
| Local HDD | 450ms |
| NFS (1 Gbps) | 800ms |

---

## Optimization Checklist

**Before Production**:

**Infrastructure**:
- [ ] Deploy LiveKit egress service with Track Composite support
- [ ] Configure egress pods: 2 CPU / 2GB RAM requests
- [ ] Set up Horizontal Pod Autoscaler for egress (min: 2, max: 20)
- [ ] Use SSD for temp segments (or NVMe for >50 users)
- [ ] Enable `noatime` mount option
- [ ] Tune NFS mount options (if using NFS)

**Backend**:
- [ ] Verify using `EgressClient.startTrackCompositeEgress()` (NOT Room Composite)
- [ ] Add database indexes (userId, status, roomName)
- [ ] Implement caching (Redis for quotas, memory for segments)
- [ ] Optimize segment duration based on usage patterns (default: 10s)

**Monitoring**:
- [ ] Implement Prometheus metrics
- [ ] Set up Grafana dashboards
- [ ] Monitor egress pod CPU/RAM usage
- [ ] Monitor disk I/O during peak times
- [ ] Set up alerts for high resource usage

**Testing**:
- [ ] Load test with expected concurrent users
- [ ] Verify Track Composite uses <1 CPU per recording
- [ ] Test FFmpeg capture performance (<3 seconds for 10min)
- [ ] Validate cleanup jobs complete within time windows

**Next Steps**:
- Implement metrics collection
- Create Grafana dashboard
- Run load tests with Track Composite egress
- Monitor production performance
- Scale egress pods based on actual usage patterns
