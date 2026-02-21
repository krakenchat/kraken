# Kubernetes Deployment

Deploy Kraken to a Kubernetes cluster using the official Helm chart.

## Architecture

```mermaid
graph LR
    Client[Browser] --> Ingress[NGINX Ingress]
    Ingress -->|/| Frontend[Frontend<br/>React + Nginx]
    Ingress -->|/api, /socket.io| Backend[Backend<br/>NestJS]
    Backend --> MongoDB[(MongoDB<br/>Replica Set)]
    Backend --> Redis[(Redis)]
    Backend --> LiveKit[LiveKit Server]
    Backend --> FileStorage[(File Storage<br/>PVC)]
```

| Component | Replicas | Description |
|-----------|----------|-------------|
| **Backend** | 2+ | NestJS API server + Socket.IO WebSocket server |
| **Frontend** | 2+ | Static React app served via nginx |
| **MongoDB** | 3 | Replica set (`rs0`) — bundled or external |
| **Redis** | 1 | Cache and Socket.IO adapter — bundled or external |
| **LiveKit** | external | Voice/video media server ([Cloud](https://cloud.livekit.io/) or [self-hosted](https://docs.livekit.io/home/self-hosting/deployment/)) |

## Prerequisites

- **Kubernetes** (v1.24+) — managed (GKE, EKS, AKS) or self-hosted (k3s, kubeadm)
- **Helm** (v3.8+)
- **kubectl** configured for your cluster
- **NGINX Ingress Controller**
- **LiveKit** — [LiveKit Cloud](https://cloud.livekit.io/) or a [self-hosted server](https://docs.livekit.io/home/self-hosting/deployment/)

Optional: **cert-manager** for automatic TLS, **metrics-server** for autoscaling.

## Quick start

### 1. Generate secrets

```bash
export JWT_SECRET=$(openssl rand -base64 32)
export JWT_REFRESH_SECRET=$(openssl rand -base64 32)
```

### 2. Install the chart

The simplest install uses bundled MongoDB and Redis:

```bash
helm install kraken oci://ghcr.io/krakenchat/charts/kraken \
  --set secrets.jwtSecret="$JWT_SECRET" \
  --set secrets.jwtRefreshSecret="$JWT_REFRESH_SECRET" \
  --set ingress.hosts[0].host=kraken.yourdomain.com \
  --set livekit.url=wss://your-livekit-server.com \
  --set livekit.apiKey=YOUR_KEY \
  --set livekit.apiSecret=YOUR_SECRET \
  --namespace kraken \
  --create-namespace
```

### 3. Verify

```bash
kubectl get pods -n kraken --watch
```

Wait for all pods to show `Running`, then visit your domain.

## Configuration

For anything beyond the quick start, create a values file:

```bash
helm install kraken oci://ghcr.io/krakenchat/charts/kraken \
  --values custom-values.yaml \
  --namespace kraken \
  --create-namespace
```

### Minimal values file

```yaml title="custom-values.yaml"
# --- Images ---
backend:
  image:
    repository: ghcr.io/krakenchat/kraken-backend
    tag: "latest"

frontend:
  image:
    repository: ghcr.io/krakenchat/kraken-frontend
    tag: "latest"

# --- Secrets ---
secrets:
  jwtSecret: ""      # Set via --set or use existingSecret
  jwtRefreshSecret: ""

# --- LiveKit ---
livekit:
  url: "wss://your-livekit-server.com"
  apiKey: "your-api-key"
  apiSecret: "your-api-secret"

# --- Ingress ---
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: kraken.yourdomain.com
      paths:
        - path: /
          pathType: Prefix
          service: frontend
        - path: /api
          pathType: Prefix
          service: backend
        - path: /socket.io
          pathType: Prefix
          service: backend
  tls:
    mode: cert-manager
    certManager:
      issuer: letsencrypt-prod

# --- Data stores (bundled by default) ---
mongodb:
  bundled: true

redis:
  bundled: true
```

### Ingress

The chart configures path-based routing through an NGINX ingress with annotations for WebSocket support (long timeouts, sticky sessions, upgrade headers). Three routes are defined:

| Path | Routes to | Purpose |
|------|-----------|---------|
| `/` | Frontend | Static React app |
| `/api` | Backend | REST API |
| `/socket.io` | Backend | WebSocket real-time events |

**TLS modes:**

```yaml
# Automatic with cert-manager (recommended)
tls:
  mode: cert-manager
  certManager:
    issuer: letsencrypt-prod

# Existing TLS secret
tls:
  mode: manual
  secretName: my-tls-secret

# No TLS (dev only)
tls:
  mode: "none"
```

### MongoDB

The chart bundles a Bitnami MongoDB replica set by default. For production, consider running MongoDB externally for more control:

=== "Bundled (default)"

    ```yaml
    mongodb:
      bundled: true
      replicaCount: 3
      auth:
        rootPassword: "CHANGE-ME"
        password: "CHANGE-ME"
      persistence:
        size: 50Gi
    ```

=== "External"

    ```yaml
    mongodb:
      bundled: false
      external:
        uri: "mongodb://user:password@mongo-host:27017/kraken?replicaSet=rs0&retryWrites=true&w=majority"
    ```

!!! note
    MongoDB **must** run as a replica set (`rs0`). Kraken uses change streams for real-time features, which require replica set mode.

### Redis

Same pattern — bundled or external:

=== "Bundled (default)"

    ```yaml
    redis:
      bundled: true
      auth:
        password: "CHANGE-ME"
      master:
        persistence:
          size: 10Gi
    ```

=== "External"

    ```yaml
    redis:
      bundled: false
      external:
        host: "redis.example.com"
        port: 6379
        password: "your-redis-password"
    ```

### LiveKit

Kraken requires a LiveKit server for voice and video. The chart doesn't bundle LiveKit — use [LiveKit Cloud](https://cloud.livekit.io/) or a [self-hosted deployment](https://docs.livekit.io/home/self-hosting/deployment/).

```yaml
livekit:
  url: "wss://your-livekit-server.com"
  apiKey: "your-api-key"
  apiSecret: "your-api-secret"
  webhookSecret: "your-webhook-secret"  # optional
```

Configure your LiveKit server to send webhooks to `https://your-domain.com/api/livekit/webhook` for voice presence tracking.

!!! note "Replay capture with LiveKit Cloud"
    LiveKit Cloud writes egress output to cloud storage (S3/GCS/Azure Blob), which Kraken can't read from yet. Replay capture is not available with LiveKit Cloud until cloud storage support is added — voice and video calls work normally. See [#227](https://github.com/krakenchat/kraken/issues/227) for progress.

### File storage

User-uploaded files (avatars, attachments) need a `ReadWriteMany` PVC so all backend replicas can access them:

```yaml
fileStorage:
  enabled: true
  size: 100Gi
  storageClassName: "your-rwx-storage-class"  # e.g., EFS, AzureFile, NFS
```

When `fileStorage.enabled: false` (the default), an ephemeral `emptyDir` is used and files are lost on pod restart.

### Replay storage (LiveKit egress)

The replay/clip capture feature requires LiveKit egress and the Kraken backend to share a storage volume for HLS segment access. Both the egress service and backend pods must be able to read and write to the same path. Enable a `ReadWriteMany` PVC:

```yaml
replayStorage:
  enabled: true
  size: 50Gi
  storageClassName: "your-rwx-storage-class"  # must be ReadWriteMany (e.g., EFS, AzureFile, NFS)
```

Configure your LiveKit egress to write segments to the same volume mounted at the backend's `REPLAY_EGRESS_OUTPUT_PATH`.

### Secrets management

By default the chart creates a Kubernetes Secret from the values you provide. For production, use an external secret manager:

```yaml
secrets:
  existingSecret: "my-pre-created-secret"  # Helm won't create its own
```

The secret must contain: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `LIVEKIT_API_SECRET`, and `REDIS_PASSWORD` (if using Redis auth).

### Resources and autoscaling

```yaml
backend:
  resources:
    requests: { cpu: 250m, memory: 512Mi }
    limits: { cpu: 1000m, memory: 1Gi }
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70

frontend:
  resources:
    requests: { cpu: 100m, memory: 128Mi }
    limits: { cpu: 500m, memory: 256Mi }
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 5
```

## Operations

### Upgrading

```bash
helm upgrade kraken oci://ghcr.io/krakenchat/charts/kraken \
  --reuse-values \
  --set backend.image.tag=v1.1.0 \
  --set frontend.image.tag=v1.1.0 \
  --namespace kraken
```

### Rollback

```bash
helm history kraken -n kraken
helm rollback kraken -n kraken        # previous version
helm rollback kraken 2 -n kraken      # specific revision
```

### Backup MongoDB

```bash
kubectl exec -n kraken kraken-mongodb-0 -- \
  mongodump --uri="mongodb://localhost:27017/kraken" \
  --gzip --archive=/tmp/backup.gz

kubectl cp kraken/kraken-mongodb-0:/tmp/backup.gz ./backup.gz
```

### Restore MongoDB

```bash
kubectl cp ./backup.gz kraken/kraken-mongodb-0:/tmp/backup.gz

kubectl exec -n kraken kraken-mongodb-0 -- \
  mongorestore --uri="mongodb://localhost:27017/kraken" \
  --gzip --archive=/tmp/backup.gz --drop
```

### Logs

```bash
kubectl logs -n kraken -l app.kubernetes.io/component=backend -f
kubectl logs -n kraken -l app.kubernetes.io/component=frontend -f
```

## Troubleshooting

For WebSocket and LiveKit connectivity issues, see the dedicated [WebSocket Troubleshooting](websocket-troubleshooting.md) guide.

### Pods stuck in Pending

```bash
kubectl describe pod -n kraken <pod-name>
```

Common causes: insufficient resources, PVC not bound, image pull errors.

### Database connection errors

```bash
kubectl get pods -n kraken -l app.kubernetes.io/name=mongodb
kubectl exec -it -n kraken deploy/kraken-backend -- sh -c 'mongosh "$MONGODB_URL"'
```

### Ingress not working

```bash
kubectl describe ingress -n kraken
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller
```

## Production checklist

- [ ] All default passwords and secrets changed
- [ ] TLS enabled via cert-manager or manual secret
- [ ] Resource limits and autoscaling configured
- [ ] External MongoDB with authentication (recommended over bundled)
- [ ] External Redis with authentication
- [ ] `ReadWriteMany` PVC for file storage
- [ ] LiveKit webhook URL configured
- [ ] Monitoring and alerting in place
- [ ] Backup strategy for MongoDB
- [ ] DNS configured for your domain
