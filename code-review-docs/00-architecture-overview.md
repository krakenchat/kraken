# 00 — System Architecture & Design

> Kraken is a self-hosted voice and text chat application built with NestJS + React.
> This document covers the high-level system design, service topology, and request lifecycles.

---

## Table of Contents

- [System Diagram](#system-diagram)
- [Tech Stack](#tech-stack)
- [Monorepo Structure](#monorepo-structure)
- [Docker Compose Topology](#docker-compose-topology)
- [HTTP Request Lifecycle](#http-request-lifecycle)
- [Real-Time Lifecycle](#real-time-lifecycle)
- [Deployment Targets](#deployment-targets)

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                     │
│                                                                          │
│   ┌──────────┐    ┌──────────────┐    ┌──────────────────┐              │
│   │  Browser  │    │  Electron    │    │  PWA (Service    │              │
│   │  (React)  │    │  Desktop     │    │  Worker + Push)  │              │
│   └────┬─────┘    └──────┬───────┘    └────────┬─────────┘              │
│        │                 │                      │                         │
│        └─────────────────┼──────────────────────┘                        │
│                          │                                                │
│              ┌───────────┴───────────┐                                   │
│              │  HTTP (:5173 → :3000) │                                   │
│              │  WS   (Socket.IO)     │                                   │
│              └───────────┬───────────┘                                   │
└──────────────────────────┼──────────────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────────────┐
│                     BACKEND SERVICES                                     │
│                                                                          │
│  ┌───────────────────────┴────────────────────────────┐                 │
│  │              NestJS Backend (:3000)                  │                 │
│  │                                                      │                │
│  │  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌─────────┐│                 │
│  │  │   REST   │ │ WebSocket│ │  Guards  │ │  Event  ││                 │
│  │  │ Contrlrs │ │ Gateways │ │ JWT+RBAC │ │ Emitter ││                 │
│  │  └────┬─────┘ └────┬─────┘ └─────────┘ └────┬────┘│                 │
│  │       │             │                         │     │                 │
│  │  ┌────┴─────────────┴─────────────────────────┴──┐  │                │
│  │  │              Services Layer                    │  │                │
│  │  │  (Messages, Channels, Auth, Voice, Files...)   │  │                │
│  │  └────┬───────────────────────────────┬──────────┘  │                │
│  │       │                               │              │                │
│  │  ┌────┴────┐                    ┌─────┴─────┐       │                │
│  │  │ Prisma  │                    │  Redis     │       │                │
│  │  │  ORM    │                    │  (Cache +  │       │                │
│  │  │         │                    │  Pub/Sub)  │       │                │
│  │  └────┬────┘                    └─────┬─────┘       │                │
│  └───────┼───────────────────────────────┼─────────────┘                │
│          │                               │                               │
│  ┌───────┴────────┐            ┌─────────┴──────────┐                   │
│  │  PostgreSQL 17  │            │    Redis (Latest)   │                  │
│  │    (:5432)      │            │      (:6379)        │                  │
│  │                 │            │                     │                   │
│  │  • 35 models    │            │  • Socket.IO adapter│                  │
│  │  • 11 enums     │            │  • WS room state    │                  │
│  │  • 40+ indexes  │            │  • Presence cache   │                  │
│  └─────────────────┘            └─────────────────────┘                  │
│                                                                          │
│  ┌─────────────────────────────────────────────────┐                    │
│  │              LiveKit Stack                       │                    │
│  │                                                   │                   │
│  │  ┌──────────────────┐    ┌────────────────────┐  │                   │
│  │  │  LiveKit Server   │    │  LiveKit Egress    │  │                   │
│  │  │  (:7880)          │    │  (HLS recording)   │  │                   │
│  │  │                   │    │                    │  │                    │
│  │  │  • Voice/Video    │    │  • Replay buffer   │  │                   │
│  │  │  • Screen share   │    │  • Segment storage │  │                   │
│  │  │  • SFU routing    │    │  • FFmpeg clips    │  │                   │
│  │  └───────┬───────────┘    └────────┬───────────┘  │                  │
│  │          │ webhooks                │ volume        │                   │
│  │          └────────┐  ┌─────────────┘              │                   │
│  │                   ▼  ▼                             │                  │
│  │            ┌──────────────┐                        │                  │
│  │            │ egress-data  │ (shared Docker volume) │                  │
│  │            └──────────────┘                        │                  │
│  └─────────────────────────────────────────────────┘                    │
│                                                                          │
│  ┌──────────────────────────────────────┐                               │
│  │  Support Services                     │                               │
│  │                                        │                              │
│  │  • livekit-ip-watcher (Alpine)        │                               │
│  │    Monitors external IP, restarts     │                               │
│  │    LiveKit on change (residential)    │                               │
│  │                                        │                              │
│  │  • egress-init (Busybox)              │                               │
│  │    Sets volume permissions on startup │                               │
│  └──────────────────────────────────────┘                               │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Backend Framework** | NestJS | 11.x |
| **Language** | TypeScript | 5.7.x |
| **Database** | PostgreSQL | 17 |
| **ORM** | Prisma | 6.6.0 |
| **Cache / Pub-Sub** | Redis (ioredis) | Latest / 5.6.1 |
| **Real-Time** | Socket.IO + Redis Adapter | 4.8.x |
| **Voice/Video** | LiveKit Server SDK | 2.15.0 |
| **Frontend Framework** | React | 19.0.0 |
| **Build Tool** | Vite | 6.4.1 |
| **UI Library** | Material-UI (MUI) | 7.0.2 |
| **Server State** | TanStack Query | 5.90.x |
| **Router** | React Router | 7.5.3 |
| **Desktop** | Electron | 38.8.x |
| **Auth** | JWT + Passport.js | @nestjs/jwt 11.x |
| **Validation** | class-validator + class-transformer | 0.14.x |
| **API Docs** | NestJS Swagger (OpenAPI) | 11.x |
| **Video Processing** | fluent-ffmpeg | 2.1.3 |
| **Security** | Helmet, bcrypt | 8.x, 5.x |
| **Testing (BE)** | Jest + @suites/unit | 29.7.0 |
| **Testing (FE)** | Vitest + Testing Library + MSW | 4.x |
| **Package Manager** | pnpm | 10.30.0 |
| **Node** | Node.js | 24.x |

---

## Monorepo Structure

```
kraken/
├── backend/                 # NestJS backend server
│   ├── src/                 # Source code (37 modules)
│   ├── prisma/              # Schema + migrations
│   ├── test/                # E2E tests
│   ├── Dockerfile           # Node 24-slim + ffmpeg + openssl
│   └── package.json
│
├── frontend/                # React 19 + Vite SPA
│   ├── src/                 # Source code
│   │   ├── api-client/      # Auto-generated OpenAPI SDK (gitignored)
│   │   ├── components/      # Feature-organized components (23 dirs)
│   │   ├── hooks/           # Custom React hooks
│   │   ├── pages/           # Route-level pages (lazy-loaded)
│   │   ├── socket-hub/      # WebSocket event management
│   │   ├── contexts/        # React contexts
│   │   ├── theme/           # MUI theme config
│   │   └── utils/           # Helpers (platform, tokens, etc.)
│   ├── electron/            # Electron main + preload (907 lines)
│   ├── Dockerfile           # Node 24-slim + Vite dev server
│   └── package.json
│
├── shared/                  # Shared TypeScript package
│   └── src/
│       ├── events.ts        # ClientEvents, ServerEvents enums
│       ├── payloads.ts      # WebSocket payload types
│       ├── types.ts         # Span, Message, Channel, Reaction types
│       └── index.ts         # Re-exports everything
│
├── helm/                    # Kubernetes Helm charts
│   └── kraken/
│       └── charts/          # PostgreSQL 16.4.3, Redis 19.6.4
│
├── docs-site/               # Documentation website source
├── scripts/                 # Utilities (livekit-ip-watcher.sh)
├── postman/                 # Postman API collection
├── .github/                 # CI/CD workflows
├── docker-compose.yml       # Development environment (8 services)
└── docker-compose.prod.yml  # Production configuration
```

The `shared` package is consumed by both backend and frontend via pnpm workspace:
- Backend: `@kraken/shared: workspace:*`
- Frontend: `@kraken/shared: workspace:*` + Vite alias resolving to `../shared/src`

---

## Docker Compose Topology

### Services (8 total)

| Service | Image/Build | Port | Purpose |
|---------|------------|------|---------|
| **backend** | `backend/Dockerfile` | 3000 | NestJS API + WebSocket server |
| **frontend** | `frontend/Dockerfile` | 5173 | Vite dev server (proxies `/api` + `/socket.io` → backend) |
| **postgres** | `postgres:17` | 5432 | Primary database |
| **redis** | `redis:latest` | 6379 | Socket.IO adapter, presence cache |
| **livekit** | `livekit/livekit-server:latest` | 7880, 7881, 7882/udp | Voice/video SFU server |
| **livekit-egress** | `livekit/egress:latest` | — | HLS recording for replay buffer |
| **livekit-ip-watcher** | `alpine:latest` | — | Restarts LiveKit on external IP change |
| **egress-init** | `busybox:latest` | — | Init container: sets volume permissions |

### Volumes

| Volume | Shared Between | Purpose |
|--------|---------------|---------|
| `pgdata` | postgres | Database persistence |
| `redisdata` | redis | Redis persistence |
| `egress-data` | livekit-egress ↔ backend | HLS segment storage (mounted at `/out` and `/app/storage/replay-segments`) |

### Health Checks

- **postgres**: `pg_isready -U kraken` (5s interval, 10 retries)
- **redis**: `redis-cli ping` (5s interval, 10 retries)
- **backend**: Waits for postgres (healthy) + redis (healthy) + livekit (started)
- **frontend**: Waits for backend + redis
- **livekit-egress**: Waits for egress-init (completed) + livekit + redis

### Key Environment Variables (Backend)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Token signing keys |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | LiveKit auth |
| `LIVEKIT_URL` | LiveKit server URL |
| `REDIS_HOST` / `REDIS_PORT` | Redis connection |
| `REPLAY_SEGMENTS_PATH` | Egress HLS segment directory |
| `STORAGE_TYPE` / `S3_*` / `AZURE_*` | File storage backend |

---

## HTTP Request Lifecycle

```
Client (Browser/Electron)
    │
    │  GET /api/channels/:communityId
    ▼
Vite Dev Proxy (:5173 → :3000)  ─── production: Nginx/Ingress direct
    │
    ▼
NestJS HTTP Pipeline (:3000)
    │
    ├─ 1. Helmet (security headers)
    ├─ 2. CORS (origin validation)
    ├─ 3. Cookie Parser
    ├─ 4. TimingInterceptor (request timing)
    ├─ 5. ValidationPipe (class-validator, whitelist + transform)
    │
    ├─ 6. JwtAuthGuard (global — skipped for @Public() routes)
    │      └─ Extracts JWT from Authorization header
    │      └─ Validates token, attaches user to request
    │
    ├─ 7. ThrottlerGuard (global — rate limiting)
    │
    ├─ 8. RbacGuard (per-route, via @RequiredActions decorator)
    │      └─ Loads user roles for resource context
    │      └─ Checks user has required RbacActions
    │
    ├─ 9. Controller method executes
    │      └─ Calls service layer
    │      └─ Service uses Prisma ORM for DB queries
    │      └─ May emit EventEmitter2 domain events
    │
    ├─ 10. ClassSerializerInterceptor
    │       └─ Applies @Exclude() decorators (strips sensitive fields)
    │       └─ Transforms entities to DTOs
    │
    └─ 11. Response sent (JSON)
```

> **Review Point:** The global `JwtAuthGuard` means all routes require authentication by default. Public routes must explicitly opt out with `@Public()`. This is a secure-by-default pattern but requires diligence when adding new public endpoints.

---

## Real-Time Lifecycle

```
Client (Socket.IO)
    │
    │  connect (handshake with JWT)
    ▼
Socket.IO Server (NestJS Gateway)
    │
    ├─ 1. WsJwtAuthGuard
    │      └─ Validates JWT from handshake auth
    │      └─ Attaches user to socket
    │
    ├─ 2. WsThrottleGuard (rate limiting per event)
    │
    ├─ 3. ValidationPipe (whitelist + transform on payload)
    │
    ├─ 4. Gateway handler executes
    │      └─ @SubscribeMessage('event_name')
    │      └─ Calls service layer
    │
    ├─ 5. Room-based broadcasting
    │      └─ Redis adapter syncs across instances
    │      └─ socket.to(room).emit(event, payload)
    │
    └─ 6. Client receives event
           └─ SocketHub dispatches to registered handlers
           └─ Handler updates TanStack Query cache
               (setQueryData or invalidateQueries)
```

### Event Flow Example: Send Message

```
Client                    Backend                    Other Clients
  │                         │                           │
  │  ClientEvent:           │                           │
  │  SEND_MESSAGE ─────────►│                           │
  │  {channelId, spans}     │                           │
  │                         │  1. Validate + auth       │
  │                         │  2. Check slowmode         │
  │                         │  3. Insert message + spans │
  │                         │  4. Process mentions        │
  │                         │  5. Create notifications    │
  │                         │  6. Emit to room            │
  │                         │                            │
  │  ServerEvent:           │  ServerEvent:              │
  │  NEW_MESSAGE ◄──────────│──────────► NEW_MESSAGE     │
  │  {full message obj}     │  {full message obj}        │
  │                         │                            │
  │  setQueryData(          │           setQueryData(    │
  │    ['messages',chId],   │             ['messages',   │
  │    append(msg))         │              chId],        │
  │                         │             append(msg))   │
```

### Redis Adapter for Multi-Instance

When running multiple backend instances (Kubernetes), the Socket.IO Redis adapter ensures events reach all connected clients regardless of which instance they're connected to:

```
Instance A                  Redis Pub/Sub             Instance B
    │                          │                          │
    │  emit('room:123', msg)   │                          │
    │ ─────────────────────►   │  ──────────────────────► │
    │                          │                          │
    │  Clients on A receive    │      Clients on B receive│
```

---

## Deployment Targets

### 1. Docker Compose (Development + Small Self-Host)

- `docker-compose.yml` — Development with hot reload
- `docker-compose.prod.yml` — Production with built images
- All 8 services in single-host deployment

### 2. Kubernetes (Helm Chart)

- Helm chart at `helm/kraken/`
- Bundled PostgreSQL 16.4.3 and Redis 19.6.4 subcharts
- Supports HPA (Horizontal Pod Autoscaler) for backend
- Ingress configuration for external access
- See [09-infrastructure.md](./09-infrastructure.md) for full Helm details

### 3. Electron Desktop App

- Multi-platform: Windows, macOS, Linux
- Built with `electron-builder` (24.13.3)
- Auto-updater via `electron-updater` (6.3.9)
- Audio loopback for system audio capture
- Secure storage for refresh tokens (OS keychain)
- System tray integration, "Close to Tray"
- Custom screen sharing source picker
- See [07-voice-and-media.md](./07-voice-and-media.md) for Electron media details

### 4. PWA (Progressive Web App)

- `vite-plugin-pwa` for service worker generation
- Web push notifications via VAPID keys
- Install prompt for "Add to Home Screen"
- Registered only in web context (not Electron)

---

## Cross-References

- Database schema → [01-database-schema.md](./01-database-schema.md)
- Backend modules → [02-backend-modules.md](./02-backend-modules.md)
- Auth & RBAC guards → [03-auth-and-rbac.md](./03-auth-and-rbac.md)
- Frontend architecture → [04-frontend-architecture.md](./04-frontend-architecture.md)
- WebSocket system → [06-websocket-system.md](./06-websocket-system.md)
- Voice & media → [07-voice-and-media.md](./07-voice-and-media.md)
- Infrastructure → [09-infrastructure.md](./09-infrastructure.md)
