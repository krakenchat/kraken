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
