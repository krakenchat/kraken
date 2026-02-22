---
hide:
  - navigation
---

# Kraken

**Self-hosted Discord-like voice and text chat.**

Kraken is an open-source communication platform that gives you full control over your data. Built with a modern stack — NestJS, React, MongoDB, and LiveKit — it provides real-time messaging, voice and video calls, and community management out of the box.

---

## Features

- **Real-time messaging** — WebSocket-powered text channels with mentions, reactions, attachments, and threads
- **Voice & video calls** — Powered by [LiveKit](https://livekit.io/) with screen sharing and replay buffer support
- **Communities** — Create servers with text and voice channels, roles, and permissions
- **Direct messages** — Private conversations and group DMs with file attachments
- **Role-based access control** — Granular permissions at the instance and community level
- **Desktop app** — Electron-based desktop client alongside the web interface
- **Self-hosted** — Run on your own infrastructure with Docker Compose or Kubernetes

---

## Quick links

<div class="grid cards" markdown>

- :material-rocket-launch: **[Installation](installation/docker-compose.md)**

    Get Kraken running with Docker Compose — from first launch to production.

- :material-cog: **[Configuration](installation/configuration.md)**

    Environment variables reference for backend and frontend.

- :material-ship-wheel: **[Kubernetes](installation/kubernetes.md)**

    Deploy Kraken to a Kubernetes cluster with the official Helm chart.

- :material-monitor-arrow-down: **[Desktop App](installation/desktop-app.md)**

    Download the Electron desktop client for Windows and Linux.

- :material-account-group: **[Contributing](contributing/index.md)**

    Help improve Kraken — bug reports, features, and code contributions.

</div>

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | [NestJS](https://nestjs.com/) (TypeScript) |
| Frontend | [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) + [Material UI](https://mui.com/) |
| Database | [MongoDB](https://www.mongodb.com/) with [Prisma ORM](https://www.prisma.io/) |
| Real-time | [Socket.IO](https://socket.io/) with Redis adapter |
| Voice/Video | [LiveKit](https://livekit.io/) |
| State | [TanStack Query v5](https://tanstack.com/query/latest) |
| Auth | JWT with [Passport.js](https://www.passportjs.org/) |
| Desktop | [Electron](https://www.electronjs.org/) |

---

## License

Kraken is **dual-licensed** under the [AGPLv3](license.md) and a commercial license. Free for everyone — including commercial use — as long as you comply with AGPL terms. A commercial license is available for proprietary deployments.

Contact: licensing {at} krakenchat [dot] app
