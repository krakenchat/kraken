# WebSocket & LiveKit Troubleshooting

Troubleshooting guide for Socket.IO WebSocket and LiveKit connectivity issues in Kubernetes deployments.

## Architecture

Kraken uses two types of real-time connections:

1. **Socket.IO WebSockets** -- chat messages, presence, real-time updates
2. **LiveKit WebRTC** -- voice/video calls and screen sharing

```
Client Browser
    | WebSocket connection (with cookie affinity)
Ingress (NGINX)
    | Routes to same pod via cookie
Backend Pod A or Pod B
    | Publishes messages to Redis
Redis Pub/Sub
    | Broadcasts to all backend pods
All Backend Pods -> Emit to their connected clients
```

**Key**: Ingress cookie affinity keeps client connected to the same pod. Service-level affinity must be `None` so Redis can coordinate across pods.

---

## Common Issues

### Messages Not Delivered

**Symptoms**: Messages sent but not received, only visible to sender, intermittent delivery.

**Likely causes**: Service-level `sessionAffinity: ClientIP` blocking Redis coordination, Redis adapter disconnected, missing ingress sticky sessions.

### WebSocket Connection Fails

**Symptoms**: Connection failed/timeout, stays as HTTP polling, 400/403/502 errors.

**Likely causes**: Missing WebSocket upgrade annotations, auth issues, backend pods not ready.

### LiveKit DataChannel Errors

**Symptoms**: `Unknown DataChannel error on lossy/reliable`, `NotReadableError`.

**Likely causes**: Same ingress issues as WebSocket, LiveKit server connectivity, firewall blocking UDP/WebRTC, missing browser permissions.

### Connection Drops Immediately

**Symptoms**: Connects then disconnects within seconds, "ping timeout" errors, repeated connect/disconnect cycles.

**Likely causes**: Ingress timeout too short, service affinity issues, health checks interfering.

---

## Diagnostics

### Check Backend Pods

```bash
kubectl logs -n kraken -l app.kubernetes.io/component=backend --tail=50 | \
  grep -i "socket\|redis\|gateway"
```

Expected:
```
[RedisIoAdapter] Redis Socket.IO adapter configured successfully for multi-pod coordination
[MessagesGateway] MessagesGateway initialized
[PresenceGateway] PresenceGateway initialized
```

### Check Redis

```bash
kubectl get pods -n kraken -l app.kubernetes.io/name=redis
kubectl exec -it -n kraken deploy/kraken-backend -- sh -c 'nc -zv $REDIS_HOST $REDIS_PORT'
```

### Check Ingress

```bash
kubectl get ingress -n kraken -o yaml
```

Required annotations:

```yaml
nginx.ingress.kubernetes.io/websocket-services: "kraken-backend"
nginx.ingress.kubernetes.io/affinity: "cookie"
nginx.ingress.kubernetes.io/session-cookie-name: "kraken-affinity"
nginx.ingress.kubernetes.io/session-cookie-max-age: "3600"
nginx.ingress.kubernetes.io/affinity-mode: "persistent"
nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
```

### Check Service Affinity

```bash
kubectl get service -n kraken kraken-backend -o jsonpath='{.spec.sessionAffinity}'
```

!!! warning "Critical"
    Must return `None`, **not** `ClientIP`. Service-level ClientIP affinity breaks Redis coordination across pods.

### Test WebSocket Upgrade

```bash
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  https://your-domain.com/socket.io/?EIO=4&transport=websocket
```

Expected: `HTTP/1.1 101 Switching Protocols`

---

## Solutions

### Fix Service Session Affinity

```bash
kubectl get service -n kraken kraken-backend -o yaml | grep sessionAffinity
# If "ClientIP", upgrade Helm chart:
helm upgrade kraken ./helm/kraken -n kraken --reuse-values
kubectl rollout restart deployment/kraken-backend -n kraken
```

### Add Missing Ingress Annotations

Update `values.yaml` with the annotations listed above, then:

```bash
helm upgrade kraken ./helm/kraken -n kraken --reuse-values
```

### Fix Redis Connection

```bash
kubectl get secret -n kraken kraken-redis -o jsonpath='{.data.redis-password}' | base64 -d
# Verify password matches backend ConfigMap, restart if needed:
kubectl rollout restart deployment/kraken-backend -n kraken
```

### Fix LiveKit Browser Permissions

1. Verify HTTPS is enabled (required for WebRTC)
2. Check browser permissions for microphone/camera
3. Close other apps using the device
4. Try a different browser

---

## Verification

1. **Browser DevTools** -> Network -> Filter "WS" -> look for `101 Switching Protocols`
2. **Open two windows** with different users, send a message, verify delivery
3. **With multiple replicas**: Send message from user on Pod A, verify user on Pod B receives it
4. **Check cookies**: Application tab -> look for `kraken-affinity` cookie

---

## Pre-Deployment Checklist

- [ ] Ingress has all required WebSocket annotations
- [ ] Service has `sessionAffinity: None`
- [ ] Redis is deployed and accessible
- [ ] Backend pods log "Redis Socket.IO adapter configured successfully"
- [ ] HTTPS/TLS is enabled (required for WebRTC)
- [ ] Tested with 2+ backend replicas
- [ ] Tested message delivery between users on different pods
- [ ] Tested voice/video calls with LiveKit
