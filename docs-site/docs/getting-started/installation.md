# Installation

Get Kraken running locally with Docker Compose. This is the fastest way to start — all services (backend, frontend, MongoDB, Redis) are managed for you.

## Prerequisites

- **[Docker](https://docs.docker.com/get-docker/)** (v20+) and **Docker Compose** (v2+)
- **[Git](https://git-scm.com/)**

## Quick start

### 1. Clone the repository

```bash
git clone https://github.com/krakenchat/kraken.git
cd kraken
```

### 2. Configure environment

```bash
cp backend/env.sample backend/.env
```

Edit `backend/.env` and **change the JWT secrets**:

```env
JWT_SECRET=replace-with-a-long-random-string
JWT_REFRESH_SECRET=replace-with-a-different-long-random-string
```

!!! warning "Security"
    Never use the default secrets in production. Generate strong values with `openssl rand -base64 32`.

See the [Configuration](configuration.md) page for the full environment variable reference.

### 3. Start all services

```bash
docker-compose up
```

This brings up:

| Service | Description | URL |
|---------|------------|-----|
| **Frontend** | React + Vite (hot reload) | [http://localhost:5173](http://localhost:5173) |
| **Backend** | NestJS API (hot reload) | [http://localhost:3000](http://localhost:3000) |
| **MongoDB** | Database (replica set) | `localhost:27017` |
| **Redis** | Cache and pub/sub | `localhost:6379` |

### 4. Initialize the database

On first run, push the Prisma schema to MongoDB:

```bash
docker compose run --rm backend npm run prisma
```

This generates the Prisma client and pushes the schema to the database.

### 5. Open Kraken

Visit [http://localhost:5173](http://localhost:5173) in your browser. You're ready to [create your first account](first-run.md).

## Stopping and restarting

```bash
# Stop all services
docker-compose down

# Start again (data is persisted in Docker volumes)
docker-compose up

# Full reset (removes all data)
docker-compose down -v
```

## Voice and video (optional)

Kraken uses [LiveKit](https://livekit.io/) for voice and video calls. Without LiveKit configured, everything else works — voice/video features are simply disabled.

To enable voice and video:

1. **Sign up** at [LiveKit Cloud](https://cloud.livekit.io/) or run a [self-hosted LiveKit server](https://docs.livekit.io/home/self-hosting/local/)
2. **Add credentials** to `backend/.env`:
    ```env
    LIVEKIT_URL=wss://your-livekit-server.com
    LIVEKIT_API_KEY=your-api-key
    LIVEKIT_API_SECRET=your-api-secret
    ```
3. **Configure webhooks** — LiveKit needs to send events back to Kraken for voice presence tracking. Set the webhook URL to `https://your-kraken-domain.com/api/livekit/webhook` and enable these events:
    - `participant_joined`
    - `participant_left`
    - `egress_started`
    - `egress_updated`
    - `egress_ended`

See the [Configuration](configuration.md) page for all LiveKit-related variables.

## Troubleshooting

### "Replica set not initialized"

The Docker Compose setup automatically configures the MongoDB replica set. If you see this error, restart the containers:

```bash
docker-compose down && docker-compose up
```

### "Port already in use"

Check what's using the port and stop it:

```bash
lsof -i :3000  # Backend
lsof -i :5173  # Frontend
```

### "Prisma client not generated"

Run the Prisma setup again:

```bash
docker compose run --rm backend npm run prisma
```

### Containers won't start

Rebuild from scratch:

```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

## Next steps

- [Configuration](configuration.md) — Full environment variable reference
- [First Run](first-run.md) — Create your first user, community, and channels
- [Development Setup](../contributing/development-setup.md) — Set up for contributing
