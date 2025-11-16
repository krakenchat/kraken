# Replay Buffer - Troubleshooting Guide

Common issues and their solutions.

## Replay Buffer Won't Start

### Issue: "User already has an active replay buffer"

**Cause**: User already has an active session

**Solution**:
```bash
# Find user's active sessions
docker compose exec backend npx prisma studio
# Navigate to EgressSession, filter by userId and status='active'

# Stop active session via API
curl -X POST http://localhost:3001/livekit-replay/stop/{sessionId} \
  -H "Authorization: Bearer $TOKEN"
```

### Issue: "Community replay buffer limit reached"

**Cause**: Too many concurrent buffers in community

**Solution**:
1. Check active count:
   ```sql
   db.egressSession.count({ communityId: 'xxx', status: 'active' })
   ```
2. Increase limit (admin only):
   ```bash
   curl -X PATCH http://localhost:3001/livekit-replay/admin/community/{id}/config \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"maxConcurrent": 10}'
   ```

### Issue: "Permission denied - ENABLE_REPLAY_BUFFER"

**Cause**: User lacks RBAC permission

**Solution**:
1. Grant permission to user's role
2. Or assign user to role with permission
3. Check with:
   ```bash
   docker compose exec backend npm run console
   > await findUserPermissions('user-id')
   ```

---

## Capture Failures

### Issue: "No segments found in specified time range"

**Cause**: Segments were cleaned up or never created

**Diagnosis**:
```bash
# Check if segments exist
docker compose exec backend ls -la /app/storage/replay-buffer/{room}/{user}/

# Check cleanup job logs
docker compose logs backend | grep "Cleaned up"
```

**Solutions**:
- Increase `REPLAY_CLEANUP_BUFFER_MINUTES` from 12 to 15
- Reduce cleanup job frequency from 5min to 10min
- User should capture sooner after event

### Issue: "FFmpeg concatenation failed"

**Symptoms**: Error in logs, no replay file created

**Diagnosis**:
```bash
# Test FFmpeg manually
docker compose exec backend ffmpeg -version

# Check segment files are valid
docker compose exec backend ffmpeg -i /app/storage/replay-buffer/.../segment-xxx.ts
```

**Common Causes**:
1. **Corrupt segment**: LiveKit egress interrupted
   - Solution: Skip corrupt segments or re-capture
2. **Disk full**: No space for output file
   - Solution: Free up disk space
3. **Permission denied**: Can't write to output path
   - Solution: Check directory permissions

**Manual Test**:
```bash
# Create concat file
echo "file '/path/to/segment-1.ts'" > /tmp/concat.txt
echo "file '/path/to/segment-2.ts'" >> /tmp/concat.txt

# Run FFmpeg
docker compose exec backend ffmpeg -f concat -safe 0 -i /tmp/concat.txt \
  -c copy /tmp/test-output.mp4
```

### Issue: "User quota exceeded"

**Symptoms**: 507 Insufficient Storage error

**Solution**:
```bash
# Check user's quota
curl http://localhost:3001/livekit-replay/admin/users/{userId}/quota \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Delete old clips (user can do this)
curl -X DELETE http://localhost:3001/livekit-replay/clips/{clipId} \
  -H "Authorization: Bearer $USER_TOKEN"

# Or increase quota (admin only)
curl -X PATCH http://localhost:3001/livekit-replay/admin/users/{userId}/quota \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"quotaBytes": 10737418240}'  # 10GB
```

---

## Storage Issues

### Issue: Disk full errors

**Diagnosis**:
```bash
# Check disk usage
df -h /var/lib/kraken/storage

# Check replay buffer temp storage
du -sh /var/lib/kraken/storage/replay-buffer/*

# Check permanent replays
du -sh /var/lib/kraken/storage/replays/*
```

**Solutions**:

**1. Free up space immediately**:
```bash
# Stop all active buffers (WARNING: users will lose temp segments)
docker compose exec backend npm run console
> const sessions = await prisma.egressSession.findMany({ where: { status: 'active' } })
> for (const s of sessions) { await livekitClient.stopEgress(s.egressId) }

# Manually cleanup old segments
find /var/lib/kraken/storage/replay-buffer -name "*.ts" -mtime +1 -delete
```

**2. Long-term solutions**:
- Add more disk space
- Reduce `REPLAY_CLEANUP_BUFFER_MINUTES`
- Reduce `DEFAULT_USER_REPLAY_QUOTA_GB`
- Reduce community `maxConcurrent` limits

### Issue: Cleanup job not running

**Diagnosis**:
```bash
# Check cron jobs are active
docker compose logs backend | grep "Running cleanup"

# Check if @nestjs/schedule is loaded
docker compose exec backend npm list @nestjs/schedule
```

**Solutions**:
```typescript
// Manually trigger cleanup
docker compose exec backend npm run console
> const service = app.get(LivekitReplayService)
> await service.cleanupOldSegments()
```

### Issue: Orphaned sessions not cleaned

**Diagnosis**:
```sql
# Find sessions active > 3 hours
db.egressSession.find({
  status: 'active',
  startedAt: { $lt: new Date(Date.now() - 3 * 60 * 60 * 1000) }
})
```

**Manual Cleanup**:
```typescript
docker compose exec backend npm run console
> const sessions = await prisma.egressSession.findMany({
    where: { status: 'active', startedAt: { lt: new Date(Date.now() - 3 * 60 * 60 * 1000) } }
  })
> for (const s of sessions) {
    try {
      await livekitClient.stopEgress(s.egressId)
      await prisma.egressSession.update({
        where: { id: s.id },
        data: { status: 'stopped', endedAt: new Date() }
      })
    } catch (e) { console.error(e) }
  }
```

---

## Performance Issues

### Issue: Slow replay captures (>10 seconds)

**Diagnosis**:
```bash
# Check FFmpeg processing time
docker compose logs backend | grep "Replay captured"

# Check disk I/O
iostat -x 1

# Check CPU usage during capture
top
```

**Solutions**:
1. **Use SSD instead of HDD**
2. **Optimize FFmpeg**:
   ```typescript
   // Add preset for faster processing (slightly larger files)
   .outputOptions(['-c copy', '-preset ultrafast', '-movflags +faststart'])
   ```
3. **Parallel segment downloads** (if using NFS):
   ```typescript
   await Promise.all(segments.map(seg => downloadSegment(seg)))
   ```

### Issue: High disk I/O during active buffers

**Diagnosis**:
```bash
# Check I/O wait
vmstat 1

# Check disk throughput
iotop -o
```

**Solutions**:
1. **Increase segment duration** (fewer writes):
   ```bash
   REPLAY_SEGMENT_DURATION_SECONDS=15  # from 10
   ```
2. **Use `noatime` mount option**:
   ```yaml
   volumes:
     replay-storage:
       driver_opts:
         o: bind,noatime
   ```
3. **Upgrade to SSD**

---

## LiveKit Integration Issues

### Issue: Egress fails to start

**Symptoms**: Session created but no segments appear

**Diagnosis**:
```bash
# Check LiveKit logs
docker compose logs livekit | grep -i egress

# Check LiveKit API connection
curl https://livekit.example.com/
```

**Solutions**:
1. **Verify LiveKit credentials**:
   ```bash
   docker compose exec backend env | grep LIVEKIT
   ```
2. **Check LiveKit server version** (requires v1.2.0+)
3. **Verify user is screen sharing**:
   ```bash
   # Check LiveKit room participants
   curl https://livekit.example.com/api/rooms/{roomName}/participants
   ```

### Issue: "Egress ended" webhook received unexpectedly

**Diagnosis**:
```bash
# Check webhook logs
docker compose logs backend | grep "egress_ended"
```

**Common Causes**:
1. **User stopped screen sharing**: Normal behavior
2. **Disk full**: Check storage
3. **LiveKit crash**: Check LiveKit logs
4. **Network interruption**: Check connectivity

---

## NFS-Specific Issues

### Issue: "Permission denied" on NFS mount

**Solution**:
```bash
# On NFS server: /etc/exports
/export/kraken/storage 192.168.1.0/24(rw,sync,no_root_squash,no_subtree_check)

# Reload exports
exportfs -ra

# On client: remount with correct options
mount -t nfs -o rw,nfsvers=4 nfs-server:/export/kraken/storage /mnt/storage
```

### Issue: Slow performance on NFS

**Solution**:
```yaml
# Optimize NFS mount options
driver_opts:
  type: nfs
  o: addr=nfs-server,rw,nfsvers=4.1,hard,timeo=600,rsize=1048576,wsize=1048576
```

### Issue: NFS mount disappears

**Symptoms**: "No such file or directory" errors

**Solution**:
1. **Use `hard` mount option** (retries indefinitely)
2. **Monitor NFS server**:
   ```bash
   nfsstat -m
   ```
3. **Add health check**:
   ```typescript
   @Cron('*/5 * * * *')
   async checkNFSHealth() {
     try {
       await fs.access(this.bufferPath);
     } catch (error) {
       this.logger.error('NFS mount unavailable:', error);
       // Alert admins
     }
   }
   ```

---

## Debugging Commands

### View Active Sessions

```bash
docker compose exec backend npm run console
> await prisma.egressSession.findMany({ where: { status: 'active' }, include: { user: true } })
```

### View User's Clips

```bash
curl http://localhost:3001/livekit-replay/my-clips \
  -H "Authorization: Bearer $TOKEN"
```

### Manually Stop All Buffers

```bash
docker compose exec backend npm run console
> const sessions = await prisma.egressSession.findMany({ where: { status: 'active' } })
> for (const s of sessions) {
    await livekitClient.stopEgress(s.egressId)
    await prisma.egressSession.update({ where: { id: s.id }, data: { status: 'stopped', endedAt: new Date() } })
  }
```

### Check Disk Usage by User

```bash
find /var/lib/kraken/storage/replays -type f -printf '%s %p\n' | \
  awk '{user=gensub(/.*\/([^\/]+)\/.*/, "\\1", "g", $2); size[user]+=$1} END {for (u in size) print u, size[u]/1024/1024 " MB"}'
```

---

## Getting Help

If issues persist:

1. **Collect logs**:
   ```bash
   docker compose logs backend > backend.log
   docker compose logs livekit > livekit.log
   ```

2. **Check database state**:
   ```bash
   docker compose run -p 5555:5555 backend npx prisma studio
   ```

3. **Open GitHub issue** with:
   - Steps to reproduce
   - Error messages
   - Logs
   - System info (OS, Docker version, storage type)

---

**Next Steps**:
- Read `performance.md` for optimization tips
- Read `deployment.md` for production best practices
