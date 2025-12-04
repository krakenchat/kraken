[![License: AGPL v3 + Commercial](https://img.shields.io/badge/license-AGPL%20v3%20%2F%20Commercial-blue)](LICENSE.md)
[![Backend Coverage](https://img.shields.io/badge/coverage-90%25-brightgreen)](https://github.com/Msoenn/kraken-chat/actions/workflows/backend-tests.yml)

# Kraken Chat Backend — Developer Setup

Welcome to the Kraken Chat backend!  
This guide will help you spin up a local development environment with Docker, hot-reloading, and powered by a modern full-stack architecture.

---

## Tech Stack Overview

- **Backend:**  
  [NestJS](https://docs.nestjs.com/) (TypeScript), modular structure (`/src`), real-time via WebSockets, REST endpoints.
- **Data Layer:**  
  [Prisma ORM](https://www.prisma.io/docs/)
  - **MongoDB:** for message documents, spans, attachments, reactions, and mentions (`prisma/mongo.schema.prisma`)
- **Frontend:**  
  [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/docs/), rapid HMR via [Vite](https://vitejs.dev/).
- **Development:**  
  Docker Compose multi-service dev environment, volume mount hot-reload.

---

## Project Structure

```
repo-root/
  backend/
    prisma/
      schema.prisma       # MongoDB schema (no migrations, just push)
      generated/
    src/
    ...
  frontend/
  docker-compose.yml
```

---

## Quickstart

### 1. Start the stack with Docker Compose

```
docker-compose up
```

This will bring up:

- **backend** (NestJS backend, Node.js, hot reload)
- **frontend** (React+Vite, hot reload)
- **mongo** (persistent via Docker volume)

### 2. Access the app

- **Backend API:** http://localhost:3000
- **Frontend:** http://localhost:5173

---

## Local Development Workflow

- Source code changes in `backend/` and `frontend/` are automatically reloaded in the running containers (via Docker volume mounts).
- Database services are managed and persisted between runs by Docker volumes.

---

## LiveKit Configuration

Kraken uses [LiveKit](https://livekit.io/) for voice and video calls. You'll need a LiveKit server (self-hosted or LiveKit Cloud).

### Backend Environment Variables

Add these to `backend/.env`:

```bash
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
```

### Webhook Configuration (Required)

LiveKit must be configured to send webhook events to your Kraken backend. This is required for:
- Voice channel presence (seeing who's in a voice channel)
- Replay buffer / screen recording features

**For LiveKit Cloud:**
1. Go to [LiveKit Cloud Dashboard](https://cloud.livekit.io/)
2. Select your project → Settings → Webhooks
3. Add webhook URL: `https://your-kraken-domain.com/api/livekit/webhook`
4. Enable these events:
   - `participant_joined`
   - `participant_left`
   - `egress_started`
   - `egress_updated`
   - `egress_ended`

**For Self-Hosted LiveKit:**

Add to your `livekit.yaml` configuration:

```yaml
webhook:
  api_key: your-livekit-api-key
  urls:
    - https://your-kraken-domain.com/api/livekit/webhook
  events:
    - participant_joined
    - participant_left
    - egress_started
    - egress_updated
    - egress_ended
```

Then restart your LiveKit server.

---

## Database Migrations & Prisma

- **MongoDB (messages):** Uses `prisma db push` from `prisma/mongo.schema.prisma` to sync types in Mongo (no migrations engine).

### Running migrations in the backend container:

From the repo root, to (re-)generate the database schema:

```
docker-compose run backend npx prisma migrate dev --schema=prisma/schema.prisma --name "init"
docker-compose run backend npx prisma db push --schema=prisma/mongo.schema.prisma
```

- Or use the provided NPM scripts for convenience (from `backend/`):

  ```
  npm run prisma:migrate
  npm run prisma:mongo:push
  ```

- You **do not need to rebuild** containers after schema changes.
- For changes to take effect, just run the migration commands above.

---

## Production Deployment (Kubernetes)

Kraken can be deployed to production Kubernetes clusters using our official Helm chart.

### Quick Installation

```bash
helm install kraken oci://ghcr.io/YOUR-USERNAME/charts/kraken \
  --set ingress.hosts[0].host=kraken.yourdomain.com \
  --set livekit.url=wss://your-livekit-server.com \
  --set livekit.apiKey=YOUR_KEY \
  --set livekit.apiSecret=YOUR_SECRET \
  --set secrets.jwtSecret="$(openssl rand -base64 32)" \
  --set secrets.jwtRefreshSecret="$(openssl rand -base64 32)"
```

### Features

- 📦 **Bundled Dependencies**: Optional MongoDB and Redis included
- 🔒 **TLS/SSL Support**: Automatic certificates via cert-manager or manual
- 📈 **Auto-scaling**: Horizontal Pod Autoscaler support
- 🎯 **Production Ready**: Resource limits, health checks, and security contexts
- 🔧 **Highly Configurable**: External databases, custom resources, and more

### Documentation

- **[Helm Chart README](./helm/kraken/README.md)** - Complete chart documentation
- **[Kubernetes Deployment Guide](./docs/deployment/kubernetes.md)** - Step-by-step installation guide
- **[Docker Images](#)** - Available on GitHub Container Registry (GHCR)
  - `ghcr.io/YOUR-USERNAME/kraken-backend`
  - `ghcr.io/YOUR-USERNAME/kraken-frontend`

### Prerequisites

- Kubernetes 1.24+
- Helm 3.8+
- NGINX Ingress Controller
- LiveKit server (external)

---

## Troubleshooting

- **Prisma errors about missing schema:**  
  Ensure your `prisma/` directory is present, and not ignored in `.dockerignore`.
- **Dependency or OpenSSL errors in Docker:**  
  The backend Dockerfile installs the OpenSSL library needed by Prisma. If you see errors, rebuild your containers with:
  ```
  docker-compose build --no-cache backend migrate
  ```
- **Permission issues or file not found:**  
  Verify your docker volumes and that your local files are accessible to Docker (especially on macOS/Windows).

---

## Useful commands

- Enter a backend container shell:

  ```
  docker compose run backend bash
  ```

- Push latest Mongo schema:
  ```
  docker compose run backend npm run prisma:generate && npm run prisma:push
  ```

---

## Support

For issues or questions, please open a pull request or GitHub issue.

## 📜 License

Kraken Chat is **dual-licensed**:

- **AGPLv3** — for personal, open-source, research, non-profits, and self-hosters (see [LICENSE](./LICENSE.md)).
- **Commercial License Required** — for business, enterprise, hosted SaaS, or any commercial use (see [LICENSE_COM](./LICENSE_COM.md) and [LICENSE-FAQ.md](./LICENSE-FAQ.md)).

Commercial users: Contact us for licensing — licensing {at} krakenchat [dot] app
