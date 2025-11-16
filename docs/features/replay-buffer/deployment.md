# Replay Buffer - Deployment Guide

This guide covers deploying the replay buffer feature in self-hosted environments.

## Storage Planning

### Disk Space Requirements

**Per Active Replay Buffer:**
- **1080p 60fps**: ~540MB (12 minutes of temp segments)
- **1080p 30fps**: ~360MB (12 minutes of temp segments)
- **720p 30fps**: ~270MB (12 minutes of temp segments)

**Per Saved Replay (10 minutes):**
- **1080p 60fps**: ~450MB
- **1080p 30fps**: ~300MB
- **720p 30fps**: ~225MB

**Example Calculations:**
```
Scenario: 100 users, 10% active with replay buffers, 5GB quota each

Temp storage (active buffers):
  10 users × 540MB = 5.4GB

Permanent storage (saved replays):
  100 users × 5GB quota = 500GB max
  Actual usage (50% of quota): 250GB

Total storage needed: ~255GB minimum, 505GB for full capacity
```

### Storage Performance

| Storage Type | Sequential Write | Concurrent Buffers | Cost | Recommendation |
|--------------|------------------|--------------------|----- |----------------|
| **HDD (7200 RPM)** | 100-150 MB/s | 20-30 | Low | Small deployments (<10 active users) |
| **SSD (SATA)** | 400-500 MB/s | 100+ | Medium | Recommended for most deployments |
| **SSD (NVMe)** | 2000+ MB/s | 500+ | High | Large deployments (50+ active users) |
| **NFS (1 Gbps)** | ~125 MB/s | 30-50 | Variable | Centralized storage, good for multi-server |
| **NFS (10 Gbps)** | ~1250 MB/s | 300+ | High | Enterprise deployments |

**Write Speed Requirements:**
- **1080p 60fps**: 0.75 MB/s per buffer
- **1080p 30fps**: 0.50 MB/s per buffer
- **720p 30fps**: 0.38 MB/s per buffer

## Egress Type Comparison: Track Composite vs Room Composite

### CRITICAL: Use Track Composite for Replay Buffer

**The replay buffer feature uses Track Composite Egress**, NOT Room Composite. This is a critical distinction for resource planning:

| Aspect | Room Composite | **Track Composite (Our Use Case)** |
|--------|----------------|-------------------------------------|
| **Chrome Rendering** | ✅ YES (full browser) | ❌ NO (SDK only) |
| **CPU per Recording** | 2-6 CPUs | **0.5-1 CPU** |
| **RAM per Recording** | 2-4 GB | **500MB-1GB** |
| **Concurrent per 4-CPU Pod** | 1-2 recordings | **4-8 recordings** |
| **Use Case** | Full room layout rendering | Single participant track recording |
| **GStreamer** | ✅ YES (window capture) | ✅ YES (direct track access) |
| **Resource Cost** | CPU cost: 3.0 (heavy) | CPU cost: 2.0 (moderate) |

### Why Track Composite is Better

**Track Composite uses the LiveKit SDK directly** without launching Chrome:

> "the egress service will either launch a web template in Chrome and connect to the room (room composite requests), or it will use the sdk directly (track and track composite requests). It uses GStreamer to encode..."
> — LiveKit Documentation

**Benefits for Replay Buffer:**
- ✅ **80-90% less resource usage** compared to Room Composite
- ✅ **No Chrome overhead** (no browser process, no DOM rendering)
- ✅ **4-8x more concurrent recordings** per pod
- ✅ **Direct WebRTC track access** via SDK
- ✅ **Same HLS output quality** as Room Composite

### Resource Implications

**Previous assumption (Room Composite):**
- 5 concurrent buffers = 5 pods × 4GB/4CPU = 20GB RAM, 20 CPUs

**Actual requirement (Track Composite):**
- 5 concurrent buffers = 1-2 pods × 2GB/2CPU = 2-4GB RAM, 2-4 CPUs

**Savings: ~80% less infrastructure cost!**

## Docker Compose Configuration

### Option 1: Local Disk (Single Server)

**Best for**: Small deployments, development

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
      - REPLAY_BUFFER_DURATION_MINUTES=10
      - REPLAY_CLEANUP_BUFFER_MINUTES=12
      - DEFAULT_USER_REPLAY_QUOTA_GB=5

volumes:
  replay-storage:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/kraken/storage  # Local disk path
```

### Option 2: NFS Mount (Multi-Server)

**Best for**: Larger deployments, centralized storage

```yaml
version: '3.8'

services:
  livekit:
    image: livekit/livekit-server:latest
    volumes:
      - type: volume
        source: replay-storage
        target: /livekit-storage
        volume:
          nocopy: true

  backend:
    build: ./backend
    volumes:
      - type: volume
        source: replay-storage
        target: /app/storage
        volume:
          nocopy: true
    environment:
      - FILE_UPLOAD_DEST=/app/storage/uploads
      - REPLAY_BUFFER_PATH=/app/storage/replay-buffer
      - REPLAY_STORAGE_PATH=/app/storage/replays

volumes:
  replay-storage:
    driver: local
    driver_opts:
      type: nfs
      o: addr=nfs-server.example.com,rw,nfsvers=4
      device: ":/export/kraken/storage"
```

### Option 3: Cloud-Backed Volume (AWS EBS, GCE Persistent Disk)

**Best for**: Cloud deployments

```yaml
version: '3.8'

services:
  # ... (same as Option 1)

volumes:
  replay-storage:
    driver: cloudstor:aws  # Or rexray/ebs, gcepd, etc.
    driver_opts:
      size: 500  # GB
      backing: shared  # or relocatable
```

## Environment Configuration

### Backend `.env` File

```bash
# MongoDB
MONGODB_URL=mongodb://mongo:27017/kraken?replicaSet=rs0

# Redis
REDIS_HOST=redis

# JWT Secrets
JWT_SECRET=your-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here

# LiveKit
LIVEKIT_URL=wss://livekit.example.com
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret

# File Uploads
FILE_UPLOAD_DEST=/app/storage/uploads

# Replay Buffer
REPLAY_BUFFER_PATH=/app/storage/replay-buffer
REPLAY_STORAGE_PATH=/app/storage/replays
REPLAY_BUFFER_DURATION_MINUTES=10
REPLAY_SEGMENT_DURATION_SECONDS=10
REPLAY_CLEANUP_BUFFER_MINUTES=12
DEFAULT_USER_REPLAY_QUOTA_GB=5
```

### LiveKit Configuration

**File**: `livekit.yaml`

```yaml
port: 7880
rtc:
  port_range_start: 50000
  port_range_end: 60000

# Egress configuration
egress:
  # No additional config needed for local filesystem output
  # LiveKit will write to filesystem where it has permissions
```

## Initial Setup Steps

### 1. Create Storage Directories

```bash
# On host machine (or NFS server)
mkdir -p /var/lib/kraken/storage/uploads
mkdir -p /var/lib/kraken/storage/replay-buffer
mkdir -p /var/lib/kraken/storage/replays

# Set permissions (adjust UID/GID to match Docker containers)
chown -R 1000:1000 /var/lib/kraken/storage
chmod -R 755 /var/lib/kraken/storage
```

### 2. Start Services

```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f backend livekit

# Verify volumes are mounted
docker-compose exec backend ls -la /app/storage
docker-compose exec livekit ls -la /livekit-storage
```

### 3. Run Database Migrations

```bash
# Generate Prisma client
docker-compose exec backend npm run prisma:generate

# Push schema to database
docker-compose exec backend npm run prisma:push
```

### 4. Verify FFmpeg Installation

```bash
docker-compose exec backend ffmpeg -version
```

Expected output: FFmpeg version information

## Monitoring & Maintenance

### Disk Usage Monitoring

**Script**: `scripts/check-replay-storage.sh`

```bash
#!/bin/bash

# Check disk usage for replay buffer
echo "=== Replay Buffer Storage ==="
du -sh /var/lib/kraken/storage/replay-buffer/*
echo ""

# Check permanent replay storage
echo "=== Permanent Replay Storage ==="
du -sh /var/lib/kraken/storage/replays/*
echo ""

# Check total usage
echo "=== Total Storage Usage ==="
df -h /var/lib/kraken/storage
```

### Automated Cleanup

Cleanup jobs run automatically via NestJS cron:
- **Every 5 minutes**: Cleanup segments older than 12 minutes
- **Every hour**: Cleanup orphaned egress sessions

**Manual cleanup** (if needed):

```bash
# Stop all active egress sessions
docker-compose exec backend npm run cleanup:egress

# Remove all temp segments (will stop active buffers!)
rm -rf /var/lib/kraken/storage/replay-buffer/*

# Remove old replays (be careful!)
find /var/lib/kraken/storage/replays -type f -mtime +90 -delete
```

## Performance Tuning

### For High Concurrent User Count

**1. Optimize Segment Duration:**

Larger segments = fewer files = less I/O overhead

```bash
# Increase to 15 seconds (from 10)
REPLAY_SEGMENT_DURATION_SECONDS=15
```

**2. Disable Access Time Updates:**

```bash
# Mount with noatime to reduce writes
# In docker-compose.yml:
volumes:
  replay-storage:
    driver_opts:
      o: bind,noatime
```

**3. Use SSD for Temp Segments:**

```bash
# Separate volumes: HDD for permanent replays, SSD for temp segments
volumes:
  replay-buffer:
    driver: local
    driver_opts:
      device: /mnt/ssd/replay-buffer  # Fast SSD

  replays:
    driver: local
    driver_opts:
      device: /mnt/hdd/replays  # Slower HDD OK for permanent storage
```

### For NFS Deployments

**1. Optimize NFS Mount Options:**

```yaml
driver_opts:
  type: nfs
  o: addr=nfs-server,rw,nfsvers=4.1,hard,timeo=600,retrans=2,rsize=1048576,wsize=1048576
```

**2. Use NFSv4.1+ for Better Performance:**
- Supports pNFS (parallel NFS) for better throughput
- Better caching and locking

**3. Monitor NFS Latency:**

```bash
# Check NFS stats
nfsstat -m

# Monitor latency
nfsiostat 1
```

## Backup & Disaster Recovery

### Backup Strategy

**What to Backup:**
- ✅ Permanent replays (`/replays/**/*.mp4`)
- ✅ Database (MongoDB)
- ❌ Temp segments (`/replay-buffer/` - ephemeral, don't backup)

**Backup Script** (`scripts/backup-replays.sh`):

```bash
#!/bin/bash

BACKUP_DIR=/backup/kraken/replays
DATE=$(date +%Y%m%d)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup replays (incremental with rsync)
rsync -av --delete \
  /var/lib/kraken/storage/replays/ \
  "$BACKUP_DIR/replays-$DATE/"

# Backup database
docker-compose exec -T mongo mongodump --archive | \
  gzip > "$BACKUP_DIR/mongodb-$DATE.gz"

# Remove backups older than 30 days
find "$BACKUP_DIR" -type d -mtime +30 -exec rm -rf {} \;
```

**Cron Schedule** (daily at 2 AM):

```cron
0 2 * * * /opt/kraken/scripts/backup-replays.sh >> /var/log/kraken-backup.log 2>&1
```

### Disaster Recovery

**1. Restore from Backup:**

```bash
# Restore replays
rsync -av /backup/kraken/replays/replays-20250110/ /var/lib/kraken/storage/replays/

# Restore database
gunzip < /backup/kraken/replays/mongodb-20250110.gz | \
  docker-compose exec -T mongo mongorestore --archive
```

**2. Rebuild After Storage Failure:**

If temp segments are lost:
- Active replay buffers will stop (egress fails)
- Users will need to re-enable replay buffer
- No permanent replays are lost (separate directory)

## Scaling Considerations

### Vertical Scaling (Single Server)

**Updated for Track Composite Egress** (SDK-only, no Chrome):

| Concurrent Buffers | Storage Type | Disk Space | RAM | CPU Cores | Notes |
|--------------------|--------------|------------|-----|-----------|-------|
| **1-10** | HDD | 50GB | **2GB** | **2** | Single pod with autoscaling |
| **10-30** | SSD | 100GB | **4-6GB** | **4** | 2-3 pods |
| **30-50** | NVMe SSD | 200GB | **8-12GB** | **8** | 4-6 pods |
| **50-100** | NVMe SSD | 500GB | **16-20GB** | **12-16** | 8-10 pods with autoscaling |

**Key Changes from Previous Estimates:**
- **RAM reduced by 50-80%** (no Chrome overhead)
- **CPU reduced by 50-75%** (direct SDK access, no browser rendering)
- **Concurrent capacity per pod increased 4-8x** (was 1-2, now 4-8 per 4-CPU pod)

### Horizontal Scaling (Multi-Server)

**Challenges:**
- LiveKit egress sessions are tied to specific LiveKit server
- Shared storage (NFS/object storage) required

**Solution:**
1. Use LiveKit Cloud (managed, auto-scaling)
2. OR: Dedicated egress workers with shared storage
3. OR: Sticky sessions (route user to same LiveKit server)

## Security Hardening

### File System Permissions

```bash
# Restrict access to replay storage
chown -R livekit-user:kraken-group /var/lib/kraken/storage
chmod 750 /var/lib/kraken/storage
chmod 770 /var/lib/kraken/storage/replay-buffer
chmod 770 /var/lib/kraken/storage/replays
```

### Network Security

```bash
# If using NFS, restrict to specific IPs
# In /etc/exports on NFS server:
/export/kraken/storage 192.168.1.0/24(rw,sync,no_subtree_check,no_root_squash)
```

### Quota Enforcement

Prevent abuse by enforcing strict quotas:

```sql
-- MongoDB query to check users over quota
db.userReplayQuota.find({ usedBytes: { $gt: { $multiply: ["$quotaBytes", 0.9] } } })
```

## Troubleshooting

### Issue: "Disk Full" Errors

**Symptoms**: Egress fails, can't capture replays

**Solutions**:
1. Check disk space: `df -h /var/lib/kraken/storage`
2. Run manual cleanup: `docker-compose exec backend npm run cleanup:old-segments`
3. Increase disk space or reduce quotas

### Issue: "Permission Denied" on Segment Files

**Symptoms**: Can't read/write segments

**Solutions**:
1. Check mount permissions: `ls -la /var/lib/kraken/storage`
2. Fix ownership: `chown -R 1000:1000 /var/lib/kraken/storage`
3. Check Docker volume mount in `docker-compose.yml`

### Issue: High Disk I/O, Slow Performance

**Symptoms**: Slow replay captures, dropped segments

**Solutions**:
1. Upgrade to SSD
2. Reduce concurrent buffer limit
3. Increase segment duration (less files = less I/O)
4. Use `noatime` mount option

### Issue: NFS Mount Disconnects

**Symptoms**: Egress fails intermittently

**Solutions**:
1. Use `hard` mount option (retries indefinitely)
2. Increase `timeo` and `retrans` values
3. Monitor NFS server health
4. Consider local disk for critical deployments

## Cost Estimates

**Updated for Track Composite Egress** (80% less compute than Room Composite):

### Self-Hosted (On-Premise)

| Component | Cost (One-Time) | Cost (Monthly) |
|-----------|-----------------|----------------|
| **Server** (4 cores, **8GB RAM**, 1TB SSD) | **$800** | $0 |
| **Network** (1 Gbps) | $0 | $100 |
| **Power & Cooling** | $0 | **$25** |
| **Maintenance** | $0 | $200 (staff time) |
| **Total** | **$800** | **$325** |

**Capacity**: ~50 concurrent buffers, 100 users

**Cost per user**: **$3.25/month**

**Savings**: $1,200 upfront + $25/month vs Room Composite estimates

### Cloud-Hosted (AWS Example)

| Component | Instance Type | Cost (Monthly) |
|-----------|---------------|----------------|
| **Compute** | **c5.xlarge (4 vCPU, 8GB)** | **$125** |
| **Storage** | EBS gp3 (500GB) | $40 |
| **Data Transfer** | 1TB egress | $90 |
| **Total** | | **$255** |

**Capacity**: ~50 concurrent buffers, 100 users

**Cost per user**: **$2.55/month**

**Savings**: $125/month (~33% reduction) vs Room Composite c5.2xlarge

## Production Checklist

Before going live:

- [ ] Storage volume mounted and tested
- [ ] Disk space allocated (at least 2x expected usage)
- [ ] FFmpeg installed and working
- [ ] Database migrations applied
- [ ] Cron jobs running (check logs)
- [ ] Backup script configured and tested
- [ ] Monitoring dashboards set up
- [ ] Storage quotas configured
- [ ] Community concurrent limits set
- [ ] RBAC permissions assigned
- [ ] Load testing completed (simulate 10+ concurrent buffers)
- [ ] Disaster recovery plan documented

---

**Next Steps:**
- Monitor disk usage for first week
- Tune concurrent limits based on performance
- Collect user feedback on quality presets
- Plan storage expansion if needed
