# WebSocket & LiveKit Troubleshooting in Kubernetes

This guide provides comprehensive troubleshooting steps for Socket.IO WebSocket and LiveKit connectivity issues in Kubernetes deployments.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Common Issues](#common-issues)
- [Diagnostic Commands](#diagnostic-commands)
- [Solutions](#solutions)
- [Verification](#verification)
- [Prevention](#prevention)

## Overview

Kraken uses two types of real-time connections:

1. **Socket.IO WebSockets**: For chat messages, presence, and real-time updates
2. **LiveKit WebRTC**: For voice/video calls and screen sharing

Both require specific Kubernetes and ingress configurations to work correctly in multi-replica deployments.

### Critical Components

- **Redis Adapter**: Coordinates Socket.IO messages across multiple backend pods
- **Ingress Sticky Sessions**: Ensures WebSocket connections stay with the same pod
- **Service Configuration**: Must NOT use ClientIP affinity (breaks Redis coordination)
- **WebSocket Upgrade Headers**: Required for proper protocol upgrade

## Architecture

### Socket.IO Message Flow

```
Client Browser
    ↓ WebSocket connection (with cookie affinity)
Ingress (NGINX)
    ↓ Routes to same pod via cookie
Backend Pod A or Pod B
    ↓ Publishes messages to Redis
Redis Pub/Sub
    ↓ Broadcasts to all backend pods
All Backend Pods → Emit to their connected clients
```

### Why This Matters

- **Ingress affinity**: Keeps client connected to same pod for duration of session
- **Service affinity = None**: Allows Redis to coordinate messages across all pods
- **Redis pub/sub**: Enables messages sent to Pod A to reach clients on Pod B

## Common Issues

### 1. Messages Not Delivered

**Symptoms**:
- Messages sent but not received by other users
- Messages only visible to sender
- Intermittent message delivery

**Likely Causes**:
- Service-level `sessionAffinity: ClientIP` blocking Redis coordination
- Redis adapter not connected
- Missing ingress sticky sessions

### 2. WebSocket Connection Fails

**Symptoms**:
- Frontend shows "connection failed" or timeout errors
- WebSocket upgrade fails (stays as HTTP polling)
- Console shows 400/403/502 errors

**Likely Causes**:
- Missing WebSocket upgrade annotations on ingress
- Authentication issues
- Backend pods not ready

### 3. LiveKit DataChannel Errors

**Symptoms**:
```
Unknown DataChannel error on lossy
Unknown DataChannel error on reliable
Failed to toggle screen share: NotReadableError
```

**Likely Causes**:
- Same ingress issues as WebSocket
- LiveKit server connectivity problems
- Firewall blocking UDP/WebRTC traffic
- Browser permissions not granted

### 4. Connection Drops Immediately

**Symptoms**:
- WebSocket connects then disconnects within seconds
- "ping timeout" errors in logs
- Repeated connect/disconnect cycles

**Likely Causes**:
- Ingress timeout too short
- Service affinity issues
- Health checks interfering with connections

## Diagnostic Commands

### Check Backend Pod Status

```bash
# View all backend pods
kubectl get pods -n kraken -l app.kubernetes.io/component=backend

# Check pod logs for WebSocket activity
kubectl logs -n kraken -l app.kubernetes.io/component=backend --tail=50 | grep -i "socket\|redis\|gateway"

# Look for connection logs
kubectl logs -n kraken -l app.kubernetes.io/component=backend --tail=100 | grep -E "connected|disconnected|initialized"
```

**Expected output**:
```
[RedisIoAdapter] Connecting to Redis for Socket.IO adapter: kraken-redis-master:6379
[RedisIoAdapter] Redis pub client connected
[RedisIoAdapter] Redis sub client connected
[RedisIoAdapter] Redis Socket.IO adapter configured successfully for multi-pod coordination
[MessagesGateway] MessagesGateway initialized
[PresenceGateway] PresenceGateway initialized
[MessagesGateway] Client connected to MessagesGateway: abc123
[PresenceGateway] Client connected to PresenceGateway: abc123
```

### Check Redis Connectivity

```bash
# Verify Redis is running
kubectl get pods -n kraken -l app.kubernetes.io/name=redis

# Test Redis connection from backend pod
kubectl exec -it -n kraken deploy/kraken-backend -- sh -c 'nc -zv $REDIS_HOST $REDIS_PORT'

# Check Redis logs for pub/sub activity
kubectl logs -n kraken -l app.kubernetes.io/name=redis --tail=50

# Monitor Redis commands (WARNING: verbose!)
kubectl exec -n kraken kraken-redis-master-0 -- redis-cli MONITOR
```

**Expected Redis connection output**:
```
Connection to kraken-redis-master 6379 port [tcp/*] succeeded!
```

### Check Ingress Configuration

```bash
# View ingress configuration
kubectl get ingress -n kraken -o yaml

# Check for WebSocket annotations
kubectl get ingress -n kraken -o jsonpath='{.items[0].metadata.annotations}' | jq

# View ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller --tail=100
```

**Required annotations**:
```yaml
nginx.ingress.kubernetes.io/websocket-services: "kraken-backend"
nginx.ingress.kubernetes.io/affinity: "cookie"
nginx.ingress.kubernetes.io/session-cookie-name: "kraken-affinity"
nginx.ingress.kubernetes.io/session-cookie-max-age: "3600"
nginx.ingress.kubernetes.io/affinity-mode: "persistent"
nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
```

### Check Service Configuration

```bash
# View backend service configuration
kubectl get service -n kraken kraken-backend -o yaml

# Check session affinity setting
kubectl get service -n kraken kraken-backend -o jsonpath='{.spec.sessionAffinity}'
```

**Expected output**: `None` (NOT `ClientIP`)

**CRITICAL**: The service MUST have `sessionAffinity: None` to allow Redis adapter to coordinate messages across pods. Ingress-level cookie affinity handles sticky sessions.

### Test WebSocket Connection

```bash
# Test WebSocket upgrade from outside cluster
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  https://your-domain.com/socket.io/?EIO=4&transport=websocket
```

**Expected response**:
```
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
```

### Check Frontend Configuration

```bash
# Verify frontend has correct WebSocket URL
kubectl exec -n kraken deploy/kraken-frontend -- env | grep VITE_WS_URL

# Check frontend logs
kubectl logs -n kraken -l app.kubernetes.io/component=frontend --tail=50
```

**Expected**: `VITE_WS_URL` should point to external domain, not internal service name

## Solutions

### Solution 1: Fix Service Session Affinity

**Problem**: Service has `sessionAffinity: ClientIP` which prevents Redis from coordinating messages across pods.

**Fix**: Update the service to use `sessionAffinity: None`

```bash
# This is already fixed in helm/kraken/templates/backend/service.yaml
# Verify your deployed service:
kubectl get service -n kraken kraken-backend -o yaml | grep sessionAffinity
```

If it shows `ClientIP`, upgrade your Helm release:

```bash
helm upgrade kraken ./helm/kraken -n kraken --reuse-values
```

Then restart backend pods:

```bash
kubectl rollout restart deployment/kraken-backend -n kraken
```

### Solution 2: Add Missing Ingress Annotations

**Problem**: Ingress lacks WebSocket upgrade headers and sticky sessions.

**Fix**: Update `values.yaml` with required annotations (already updated in the chart):

```yaml
ingress:
  annotations:
    nginx.ingress.kubernetes.io/websocket-services: "kraken-backend"
    nginx.ingress.kubernetes.io/affinity: "cookie"
    nginx.ingress.kubernetes.io/session-cookie-name: "kraken-affinity"
    nginx.ingress.kubernetes.io/session-cookie-max-age: "3600"
    nginx.ingress.kubernetes.io/affinity-mode: "persistent"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
```

Apply the changes:

```bash
helm upgrade kraken ./helm/kraken -n kraken --reuse-values
```

### Solution 3: Fix Redis Connection Issues

**Problem**: Backend pods can't connect to Redis.

**Diagnostic**:
```bash
# Check Redis pod status
kubectl get pods -n kraken -l app.kubernetes.io/name=redis

# Check Redis password secret
kubectl get secret -n kraken kraken-redis -o jsonpath='{.data.redis-password}' | base64 -d
```

**Fix**: Ensure Redis password matches in ConfigMap and Secret:

```bash
# Update backend ConfigMap if needed
kubectl edit configmap -n kraken kraken-backend-config

# Restart backend pods to pick up changes
kubectl rollout restart deployment/kraken-backend -n kraken
```

### Solution 4: Fix Browser Permission Issues (LiveKit)

**Problem**: "NotReadableError: Could not start audio source"

**Causes**:
- Browser didn't grant microphone/camera permissions
- Another app is using the device
- HTTPS not enabled (required for WebRTC)

**Fix**:
1. Verify HTTPS is enabled on your domain
2. Check browser permissions for microphone/camera
3. Close other apps using the microphone/camera
4. Try a different browser

### Solution 5: Fix Ingress Controller Configuration

**Problem**: Ingress controller doesn't support WebSocket properly.

**Diagnostic**:
```bash
# Check ingress controller version
kubectl get deployment -n ingress-nginx ingress-nginx-controller -o jsonpath='{.spec.template.spec.containers[0].image}'

# Check ingress controller ConfigMap
kubectl get configmap -n ingress-nginx ingress-nginx-controller -o yaml
```

**Fix**: Ensure ingress controller is recent version (1.8+):

```bash
helm upgrade ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx
```

## Verification

### Verify WebSocket Connection

1. **Open browser DevTools** → Network tab → Filter "WS"
2. **Navigate to your Kraken instance**
3. **Look for WebSocket connection**:
   - Status should be "101 Switching Protocols"
   - Type should be "websocket"
   - Should stay connected (not repeatedly reconnecting)

### Verify Message Delivery

1. **Open two browser windows** with different users
2. **Send a message** from user 1
3. **Verify user 2 receives it immediately**
4. **Check backend logs**:
   ```bash
   kubectl logs -n kraken -l app.kubernetes.io/component=backend -f | grep "SEND_MESSAGE\|NEW_MESSAGE"
   ```

### Verify Redis Coordination

With multiple backend replicas:

1. **Send message** from user connected to Pod A
2. **Receive message** on user connected to Pod B
3. **Check both pod logs** show Redis pub/sub activity:
   ```bash
   # Terminal 1: Watch Pod A logs
   kubectl logs -n kraken kraken-backend-xxxxx-aaaaa -f

   # Terminal 2: Watch Pod B logs
   kubectl logs -n kraken kraken-backend-xxxxx-bbbbb -f
   ```

**Expected**: Both pods log connection events even though clients are connected to different pods.

### Verify Sticky Sessions

1. **Open DevTools** → Application tab → Cookies
2. **Look for cookie** named `kraken-affinity`
3. **Send multiple messages** and verify requests go to same pod
4. **Check ingress logs**:
   ```bash
   kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller -f | grep "kraken-backend"
   ```

## Prevention

### Pre-Deployment Checklist

Before deploying to production:

- [ ] Ingress has all required WebSocket annotations
- [ ] Service has `sessionAffinity: None`
- [ ] Redis is deployed and accessible
- [ ] Backend pods log "Redis Socket.IO adapter configured successfully"
- [ ] All gateways show "initialized" in logs
- [ ] HTTPS/TLS is enabled (required for WebRTC)
- [ ] Test with 2+ backend replicas
- [ ] Test message delivery between users on different pods
- [ ] Test voice/video calls with LiveKit
- [ ] Monitor logs for errors during testing

### Regular Monitoring

Set up alerts for:

- WebSocket connection failures
- Redis connection errors
- Repeated client reconnections
- Backend pod restarts
- Ingress errors

### Recommended Monitoring Queries

```bash
# Count WebSocket connections per pod
kubectl logs -n kraken -l app.kubernetes.io/component=backend --tail=1000 | grep "Client connected" | wc -l

# Count Redis errors
kubectl logs -n kraken -l app.kubernetes.io/component=backend --tail=1000 | grep -i "redis.*error" | wc -l

# Count disconnections
kubectl logs -n kraken -l app.kubernetes.io/component=backend --tail=1000 | grep "Client disconnected" | wc -l
```

### Load Testing

Test WebSocket stability under load:

```bash
# Use a WebSocket load testing tool
npm install -g artillery

# Create load test config
cat > websocket-load-test.yml <<EOF
config:
  target: "wss://your-domain.com"
  phases:
    - duration: 60
      arrivalRate: 10
  engines:
    socketio:
      transports: ["websocket"]
scenarios:
  - engine: socketio
    flow:
      - emit:
          channel: "SEND_MESSAGE"
          data:
            channelId: "test-channel-id"
            content: "Load test message"
EOF

# Run load test
artillery run websocket-load-test.yml
```

## Advanced Debugging

### Enable Debug Logging

Add environment variable to backend deployment:

```yaml
env:
  - name: DEBUG
    value: "socket.io*,redis*"
```

Apply and check logs:

```bash
kubectl set env deployment/kraken-backend -n kraken DEBUG="socket.io*,redis*"
kubectl logs -n kraken -l app.kubernetes.io/component=backend -f
```

### Network Packet Capture

For deep investigation:

```bash
# Install tcpdump in backend pod (for debug image only)
kubectl exec -it -n kraken deploy/kraken-backend -- apt-get update && apt-get install -y tcpdump

# Capture WebSocket traffic
kubectl exec -it -n kraken deploy/kraken-backend -- tcpdump -i any -A 'tcp port 3000' -w /tmp/capture.pcap

# Copy capture file
kubectl cp kraken/kraken-backend-xxxxx:/tmp/capture.pcap ./capture.pcap
```

### Test Redis Pub/Sub Directly

```bash
# Terminal 1: Subscribe to all channels
kubectl exec -it -n kraken kraken-redis-master-0 -- redis-cli
PSUBSCRIBE "*"

# Terminal 2: Trigger message send from frontend
# Watch Terminal 1 for pub/sub messages
```

## Additional Resources

- [Socket.IO Redis Adapter Docs](https://socket.io/docs/v4/redis-adapter/)
- [NGINX Ingress WebSocket Docs](https://kubernetes.github.io/ingress-nginx/user-guide/miscellaneous/#websockets)
- [LiveKit Deployment Guide](https://docs.livekit.io/deploy/)
- [Kubernetes Service Types](https://kubernetes.io/docs/concepts/services-networking/service/#session-affinity)
- [Main Kubernetes Deployment Guide](./kubernetes.md)
