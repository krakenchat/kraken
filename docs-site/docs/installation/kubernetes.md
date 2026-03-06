# Kubernetes

Deploy Semaphore Chat to a Kubernetes cluster using the official Helm chart.

## Architecture

```mermaid
graph LR
    Client[Browser] --> Ingress[NGINX Ingress]
    Ingress -->|/| Frontend[Frontend<br/>React + Nginx]
    Ingress -->|/api, /socket.io| Backend[Backend<br/>NestJS]
    Backend --> PostgreSQL[(PostgreSQL)]
    Backend --> Redis[(Redis)]
    Backend --> LiveKit[LiveKit Server]
    Backend --> FileStorage[(File Storage<br/>PVC)]
```

| Component | Replicas | Description |
|-----------|----------|-------------|
| **Backend** | 2+ | NestJS API server + Socket.IO WebSocket server |
| **Frontend** | 2+ | Static React app served via nginx |
| **PostgreSQL** | 1+ | Database — bundled or external |
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
export POSTGRES_PASSWORD=$(openssl rand -base64 32)
export REDIS_PASSWORD=$(openssl rand -base64 32)
```

### 2. Install the chart

The simplest install uses bundled PostgreSQL and Redis:

```bash
helm install semaphore-chat oci://ghcr.io/semaphore-chat/charts/semaphore-chat \
  --set secrets.jwtSecret="$JWT_SECRET" \
  --set secrets.jwtRefreshSecret="$JWT_REFRESH_SECRET" \
  --set postgresql.auth.postgresPassword="$POSTGRES_PASSWORD" \
  --set redis.auth.password="$REDIS_PASSWORD" \
  --set ingress.hosts[0].host=semaphore.yourdomain.com \
  --set livekit.url=wss://your-livekit-server.com \
  --set livekit.apiKey=YOUR_KEY \
  --set livekit.apiSecret=YOUR_SECRET \
  --namespace semaphore-chat \
  --create-namespace
```

### 3. Verify

```bash
kubectl get pods -n semaphore-chat --watch
```

Wait for all pods to show `Running`, then visit your domain.

## Configuration

For anything beyond the quick start, create a values file:

```bash
helm install semaphore-chat oci://ghcr.io/semaphore-chat/charts/semaphore-chat \
  --values custom-values.yaml \
  --namespace semaphore-chat \
  --create-namespace
```

### Minimal values file

```yaml title="custom-values.yaml"
# --- Images ---
backend:
  image:
    repository: ghcr.io/semaphore-chat/semaphore-backend
    tag: "latest"

frontend:
  image:
    repository: ghcr.io/semaphore-chat/semaphore-frontend
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
    - host: semaphore.yourdomain.com
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
postgresql:
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

### PostgreSQL

The chart bundles a Bitnami PostgreSQL instance by default. For production, consider running PostgreSQL externally for more control:

=== "Bundled (default)"

    ```yaml
    postgresql:
      bundled: true
      auth:
        postgresPassword: "CHANGE-ME"
      persistence:
        size: 50Gi
    ```

=== "External"

    ```yaml
    postgresql:
      bundled: false
      external:
        uri: "postgresql://user:password@postgres-host:5432/semaphore"
    ```

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

Semaphore Chat requires a LiveKit server for voice and video. The chart doesn't bundle LiveKit — use [LiveKit Cloud](https://cloud.livekit.io/) or a [self-hosted deployment](https://docs.livekit.io/home/self-hosting/deployment/).

```yaml
livekit:
  url: "wss://your-livekit-server.com"
  apiKey: "your-api-key"
  apiSecret: "your-api-secret"
  webhookSecret: "your-webhook-secret"  # optional
```

Configure your LiveKit server to send webhooks to `https://your-domain.com/api/livekit/webhook` for voice presence tracking.

!!! note "Replay capture with LiveKit Cloud"
    LiveKit Cloud writes egress output to cloud storage (S3/GCS/Azure Blob), which Semaphore Chat can't read from yet. Replay capture is not available with LiveKit Cloud until cloud storage support is added — voice and video calls work normally. See [#227](https://github.com/semaphore-chat/semaphore-chat/issues/227) for progress.

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

The replay/clip capture feature requires LiveKit egress and the Semaphore Chat backend to share a storage volume for HLS segment access. Both the egress service and backend pods must be able to read and write to the same path. Enable a `ReadWriteMany` PVC:

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
helm upgrade semaphore-chat oci://ghcr.io/semaphore-chat/charts/semaphore-chat \
  --reuse-values \
  --set backend.image.tag=v1.1.0 \
  --set frontend.image.tag=v1.1.0 \
  --namespace semaphore-chat
```

### Rollback

```bash
helm history semaphore-chat -n semaphore-chat
helm rollback semaphore-chat -n semaphore-chat        # previous version
helm rollback semaphore-chat 2 -n semaphore-chat      # specific revision
```

### Backup PostgreSQL

```bash
kubectl exec -n semaphore-chat semaphore-chat-postgresql-0 -- \
  pg_dump -U semaphore semaphore | gzip > backup.sql.gz
```

### Restore PostgreSQL

```bash
gunzip -c backup.sql.gz | kubectl exec -i -n semaphore-chat semaphore-chat-postgresql-0 -- \
  psql -U semaphore semaphore
```

### Logs

```bash
kubectl logs -n semaphore-chat -l app.kubernetes.io/component=backend -f
kubectl logs -n semaphore-chat -l app.kubernetes.io/component=frontend -f
```

## Troubleshooting

For WebSocket and LiveKit connectivity issues, see the dedicated [WebSocket Troubleshooting](../operations/websocket-troubleshooting.md) guide.

### Pods stuck in Pending

```bash
kubectl describe pod -n semaphore-chat <pod-name>
```

Common causes: insufficient resources, PVC not bound, image pull errors.

### Database connection errors

```bash
kubectl get pods -n semaphore-chat -l app.kubernetes.io/name=postgresql
kubectl exec -it -n semaphore-chat deploy/semaphore-chat-backend -- sh -c 'psql "$DATABASE_URL"'
```

### Ingress not working

```bash
kubectl describe ingress -n semaphore-chat
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller
```

## Production checklist

- [ ] All default passwords and secrets changed
- [ ] TLS enabled via cert-manager or manual secret
- [ ] Resource limits and autoscaling configured
- [ ] External PostgreSQL with authentication (recommended over bundled)
- [ ] External Redis with authentication
- [ ] `ReadWriteMany` PVC for file storage
- [ ] LiveKit webhook URL configured
- [ ] Monitoring and alerting in place
- [ ] Backup strategy for PostgreSQL
- [ ] DNS configured for your domain
