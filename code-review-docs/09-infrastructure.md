# 09 — CI/CD, Docker & Deployment

> GitHub Actions CI/CD, multi-stage Docker builds, Kubernetes Helm chart, Electron desktop builds, PWA.

---

## Table of Contents

- [CI/CD Workflows](#cicd-workflows)
- [Docker Configuration](#docker-configuration)
- [Helm Chart (Kubernetes)](#helm-chart-kubernetes)
- [Electron Build Pipeline](#electron-build-pipeline)
- [PWA](#pwa)
- [Environment Variables](#environment-variables)
- [Code Quality](#code-quality)

---

## CI/CD Workflows

8 workflows in `.github/workflows/`:

### backend-tests.yml

| Trigger | PR/push on `backend/**`, `shared/**` |
|---------|--------------------------------------|
| **Lint job** | ESLint with Node 24 + pnpm caching |
| **Test job** | Jest with PostgreSQL 17 + Redis 7 service containers |
| **Coverage** | Badges pushed to orphan `badges` branch |

### frontend-tests.yml

| Trigger | PR/push on `frontend/**`, `shared/**` |
|---------|----------------------------------------|
| **Lint job** | ESLint + TypeScript type-checking |
| **Test job** | Vitest with generated API client |
| **Coverage** | Badges pushed to orphan `badges` branch |

### e2e-tests.yml

| Trigger | Push to main, PRs, daily 6 AM UTC, manual |
|---------|---------------------------------------------|
| **Setup** | Isolated Docker network with separate ports (5433, 6380, 3001, 5174) |
| **Seed** | `prisma/seed-e2e.ts` for test data |
| **Runner** | Playwright (`mcr.microsoft.com/playwright:v1.40.0-jammy`) |
| **Modes** | Smoke tests on PR (no label), full suite on main/schedule/manual |

### docker-publish.yml

| Trigger | Push to main, tags (`v*.*.*`, `docker-v*.*.*`) |
|---------|--------------------------------------------------|
| **Registry** | GHCR (`ghcr.io/krakenchat/kraken-backend`, `kraken-frontend`) |
| **Tags** | `latest`, `sha-<commit>`, semver (major/minor/patch) |
| **Cache** | GitHub Actions cache backend |
| **Build args** | `VITE_API_URL=/api`, `VITE_WS_URL=`, version injection |

### electron-build.yml

| Trigger | Tags (`v*.*.*`, `electron-v*.*.*`), manual dispatch |
|---------|------------------------------------------------------|
| **Quality** | Lint + type-check + API client generation |
| **Platforms** | Windows (NSIS .exe), Linux (AppImage, deb, rpm) |
| **Release** | GitHub release with all artifacts |

### helm-publish.yml

| Trigger | Tags (`helm-v*.*.*`), `helm/` changes |
|---------|----------------------------------------|
| **Registry** | GHCR OCI artifacts |
| **Command** | `oci://ghcr.io/krakenchat/charts/kraken` |

### deploy-docs.yml

MkDocs → GitHub Pages (Python 3.12).

### dependabot-auto-merge.yml

Auto-approve + squash-merge patch/minor Dependabot PRs. Major versions flagged for manual review.

---

## Docker Configuration

### Development (`docker-compose.yml`)

8 services with hot reload:

```
┌───────────────┐  ┌──────────────┐  ┌────────────┐  ┌───────────┐
│   backend     │  │   frontend   │  │  postgres   │  │   redis   │
│   :3000       │  │   :5173      │  │   :5432     │  │   :6379   │
│   (hot reload)│  │  (Vite proxy)│  │   (v17)     │  │  (latest) │
└───────┬───────┘  └──────────────┘  └─────────────┘  └───────────┘
        │
┌───────┴──────┐  ┌──────────────┐  ┌─────────────┐  ┌───────────┐
│   livekit    │  │livekit-egress│  │ egress-init │  │ ip-watcher│
│   :7880      │  │ (HLS record) │  │ (permissions)│  │ (Alpine)  │
│   :7881,:7882│  │              │  │              │  │           │
└──────────────┘  └──────────────┘  └─────────────┘  └───────────┘
```

### Production (`docker-compose.prod.yml`)

| Difference from dev | Details |
|-------------------|---------|
| Dockerfiles | `Dockerfile.prod` (multi-stage) |
| Node env | `NODE_ENV=production` |
| Redis | `redis:7-alpine` with password + AOF |
| PostgreSQL | `postgres:17-alpine` |
| Frontend | Nginx serving static build |
| No LiveKit | External LiveKit expected |
| Restart policy | `unless-stopped` |
| Env files | `.env.prod` with required field validation |

### Backend Dockerfile.prod (Multi-Stage)

```dockerfile
# Stage 1: Builder
FROM node:24-slim
  → Full install, build NestJS, generate Prisma
  → Prune dev dependencies (preserve bcrypt)

# Stage 2: Production
FROM node:24-alpine
  → Non-root user (nestjs:1001)
  → OpenSSL + FFmpeg (Alpine native)
  → bcrypt rebuilt for musl libc
  → Healthcheck: GET /api/health
  → Entrypoint: run migrations, then start Node.js
```

> **Review Point:** bcrypt requires a native rebuild for Alpine's musl libc. The Dockerfile uses `node-pre-gyp` with custom disturl for this. If the pre-gyp download fails, the build fails. Consider switching to `bcryptjs` (pure JS) to avoid native dependency issues, or pin the pre-gyp version.

### Frontend Dockerfile.prod (Multi-Stage)

```dockerfile
# Stage 1: Builder
FROM node:24-slim
  → Install, generate API client
  → Vite build → dist/

# Stage 2: Nginx
FROM nginx:1.29-alpine
  → Non-root user (nginx:101)
  → envsubst for runtime variable substitution
  → Custom nginx config template
  → Health: wget /health
  → Port: 5173
```

### Shared Volumes

| Volume | Dev Mount | Prod Mount | Purpose |
|--------|-----------|-----------|---------|
| `pgdata` | Docker volume | Docker volume | PostgreSQL data |
| `redisdata` | Docker volume | Docker volume | Redis data |
| `egress-data` | Docker volume | NFS/PVC | Replay segments |

---

## Helm Chart (Kubernetes)

### Chart Structure (`helm/kraken/`)

```
helm/kraken/
├── Chart.yaml                 # Dependencies: PostgreSQL 16.4.3, Redis 19.6.4
├── values.yaml                # Comprehensive configuration
├── charts/
│   ├── postgresql-16.4.3.tgz # Bitnami PostgreSQL
│   └── redis-19.6.4.tgz      # Bitnami Redis
└── templates/
    ├── backend/
    │   ├── deployment.yaml
    │   ├── service.yaml
    │   ├── hpa.yaml
    │   ├── configmap.yaml
    │   ├── secret.yaml
    │   └── migration-job.yaml
    ├── frontend/
    │   ├── deployment.yaml
    │   └── service.yaml
    ├── ingress.yaml
    └── serviceaccount.yaml
```

### Default Resource Allocation

| Service | CPU req/limit | Memory req/limit | Replicas |
|---------|-------------|----------------|----------|
| Backend | 250m / 1000m | 512Mi / 1Gi | 2 |
| Frontend | 100m / 500m | 128Mi / 256Mi | 2 |
| PostgreSQL | 250m / 500m | 256Mi / 512Mi | 1 |
| Redis | 100m / 500m | 256Mi / 512Mi | 1 |

### Autoscaling (HPA)

| Service | Min/Max | CPU Target | Memory Target |
|---------|---------|-----------|--------------|
| Backend | 2–10 | 70% | 80% |
| Frontend | 2–10 | 70% | — |

Disabled by default — enable via `backend.autoscaling.enabled: true`.

### Ingress Configuration

```yaml
annotations:
  # WebSocket support
  nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
  nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
  nginx.ingress.kubernetes.io/proxy-connect-timeout: "60"

  # File uploads
  nginx.ingress.kubernetes.io/proxy-body-size: "100m"

  # Sticky sessions (Socket.IO multi-replica)
  nginx.ingress.kubernetes.io/affinity: "cookie"
  nginx.ingress.kubernetes.io/session-cookie-max-age: "3600"

paths:
  /           → frontend service
  /api        → backend service
  /socket.io  → backend service
```

TLS modes: `none`, `cert-manager`, `manual`.

> **Review Point:** Sticky sessions via cookie affinity are crucial for Socket.IO with multiple backend replicas. Without this, a client could connect to pod A, then a subsequent request could go to pod B which doesn't have the Socket.IO session. The Redis adapter handles event distribution, but the HTTP upgrade handshake needs to go to the same pod.

### Migration Job

```yaml
# Helm hook: pre-install, pre-upgrade
apiVersion: batch/v1
kind: Job
spec:
  template:
    spec:
      containers:
        - command: ["npx", "prisma", "migrate", "deploy"]
      backoffLimit: 3
      ttlSecondsAfterFinished: 300
```

Backend deployment has `SKIP_PRISMA_MIGRATE=true` since migrations run via the Job.

### Storage Options

| Mount | Default | Options |
|-------|---------|---------|
| `/app/uploads` | emptyDir (ephemeral) | PVC, NFS |
| `/app/replay-segments` | Disabled | NFS (shared between backend + egress) |

---

## Electron Build Pipeline

### Build Architecture

```
frontend/
├── electron/
│   ├── main.ts       → main.cjs (CommonJS)
│   └── preload.ts    → preload.cjs (CommonJS)
├── src/               → dist/ (Vite static build)
└── package.json       → electron-builder config
```

### Build Scripts

| Script | Output |
|--------|--------|
| `build:all` | Clean + Vite build + Electron main + preload |
| `build:win` | NSIS installer (.exe, .blockmap, latest.yml) |
| `build:linux` | AppImage, deb, rpm packages |
| `build:mac` | DMG / App bundle |
| `package` | Package without release (local testing) |

### Auto-Updater

- Library: `electron-updater` 6.3.9
- Check on startup (3s delay) + hourly polling
- Events: checking, available, not-available, error, progress, downloaded
- IPC: `check-for-updates`, `quit-and-install`
- Release manifest: `latest.yml` in GitHub Releases

### Key Electron Features

| Feature | Implementation |
|---------|---------------|
| Window state persistence | Position, size, maximized saved to `userData/window-state.json` |
| System tray | Toggle show/hide, "Close to Tray" setting |
| Single instance lock | Prevents multiple app windows |
| Secure storage | OS keychain for refresh tokens |
| Screen sharing | Custom source picker (X11/macOS/Windows), PipeWire portal (Wayland) |
| Audio loopback | System audio capture (macOS/Windows only) |
| Permissions | Auto-grant media, display-capture, fullscreen |
| External URLs | Open in default browser |

### Platform Differences

| Feature | Windows | macOS | Linux |
|---------|---------|-------|-------|
| Installer | NSIS (.exe) | DMG | AppImage, deb, rpm |
| Audio loopback | WASAPI | loopbackWithoutChrome | Not supported |
| Screen share | Custom picker | Custom picker | PipeWire (Wayland) or custom (X11) |
| Tray icon size | 16px | 16px | 22px |
| Secure storage | DPAPI | Keychain | libsecret |

---

## PWA

### Configuration

```typescript
// vite.config.ts
VitePWA({
  strategies: "injectManifest",  // Custom service worker
  srcDir: "src",
  filename: "sw-custom.ts",
  registerType: "autoUpdate",
  manifest: {
    name: "Kraken",
    display: "standalone",
    icons: [/* 192x192, 512x512 */],
  },
  workbox: { maximumFileSizeToCacheInBytes: 6 * 1024 * 1024 },  // 6MB
})
```

### Features

- **Service Worker:** Custom implementation for push notifications
- **Install Prompt:** `beforeinstallprompt` event → `usePWAInstall` hook
- **iOS instructions:** Manual "Add to Home Screen" guidance
- **Push notifications:** VAPID keys from backend, subscription management
- **Offline:** Workbox caching strategies

### Registration

Only registered in web context:

```typescript
// main.tsx
if (!isElectron()) {
  registerServiceWorker();
}
```

---

## Environment Variables

### Backend (Required)

| Variable | Example | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://kraken:pw@postgres:5432/kraken` | PostgreSQL connection |
| `JWT_SECRET` | Long random string | Access token signing |
| `JWT_REFRESH_SECRET` | Long random string | Refresh token signing |
| `REDIS_HOST` | `redis` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `LIVEKIT_URL` | `ws://livekit:7880` | LiveKit server |
| `LIVEKIT_API_KEY` | `devkey` | LiveKit auth |
| `LIVEKIT_API_SECRET` | Secret string | LiveKit auth |

### Backend (Optional)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment |
| `REDIS_PASSWORD` | — | Redis auth |
| `STORAGE_TYPE` | `LOCAL` | File storage backend |
| `FILE_UPLOAD_DEST` | `./uploads` | Upload directory |
| `REPLAY_SEGMENTS_PATH` | `/app/storage/replay-segments` | Egress segments |
| `ENABLE_SWAGGER` | `true` | OpenAPI docs |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed origins |

### Frontend

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_URL` | `/api` | Backend URL |
| `VITE_WS_URL` | — | WebSocket URL (empty = same origin) |
| `VITE_TELEMETRY_ENDPOINT` | — | OpenObserve endpoint |
| `VITE_APP_VERSION` | — | Version string |

---

## Code Quality

### ESLint

| Config | Backend | Frontend |
|--------|---------|----------|
| Format | ESLint 9 flat config | ESLint 9 flat config |
| TypeScript | `recommendedTypeChecked` (strict) | `recommended` |
| Prettier | Integrated | — |
| React | — | Hooks + Refresh rules |
| `no-explicit-any` | off | warn |
| `no-console` | — | warn (except Electron/SW) |
| Test exemptions | Unsafe checks relaxed | — |

### Prettier (Backend)

```json
{ "singleQuote": true, "trailingComma": "all" }
```

### TypeScript

Both backend and frontend use strict mode. Backend uses `@/*` path alias, frontend uses `@kraken/shared` alias.

---

## Deployment Cheat Sheet

### Docker Compose (Self-Host)

```bash
# Development
docker-compose up

# Production
cp backend/.env.sample backend/.env.prod  # Edit with real values
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes (Helm)

```bash
# Install
helm install kraken oci://ghcr.io/krakenchat/charts/kraken \
  --version 1.0.0 \
  --set secrets.jwtSecret="..." \
  --set secrets.jwtRefreshSecret="..." \
  --set ingress.host="kraken.example.com"

# Upgrade
helm upgrade kraken oci://ghcr.io/krakenchat/charts/kraken \
  --version 1.1.0
```

### Release Tags

| Tag Pattern | Triggers |
|-------------|----------|
| `v1.0.0` | Docker + Helm publish |
| `docker-v1.0.0` | Docker publish only |
| `electron-v1.0.0` | Electron build + release |
| `helm-v1.0.0` | Helm chart publish |

---

## Cross-References

- Docker Compose services → [00-architecture-overview.md](./00-architecture-overview.md)
- Backend modules → [02-backend-modules.md](./02-backend-modules.md)
- LiveKit services → [07-voice-and-media.md](./07-voice-and-media.md)
- Electron platform code → [04-frontend-architecture.md](./04-frontend-architecture.md)
