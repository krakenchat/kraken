FROM node:24-slim

# Install procps to provide 'ps' command (for local dev)
# Install ffmpeg for video clip processing
RUN apt-get update -y && apt-get install -y openssl ffmpeg procps && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.30.0 --activate

WORKDIR /app

# Copy root workspace config + shared and backend package.json for dependency install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY backend/prisma ./backend/prisma

# Copy shared source before install so the prepare script can build it
COPY shared/ ./shared/

RUN pnpm install

# Copy backend source
COPY backend/ ./backend/

WORKDIR /app/backend

# Regenerate Prisma client to ensure it matches the latest schema
RUN pnpm exec prisma generate --schema=prisma/schema.prisma

EXPOSE 3000

CMD ["pnpm", "run", "start:dev"]
