FROM node:25-slim

# Install procps to provide 'ps' command (for local dev)
# Install ffmpeg for video clip processing
RUN apt-get update -y && apt-get install -y openssl ffmpeg procps && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root workspace config + shared and backend package.json for dependency install
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY backend/prisma ./backend/prisma

# Copy shared source before install so the prepare script can build it
COPY shared/ ./shared/

RUN npm install

# Copy backend source
COPY backend/ ./backend/

WORKDIR /app/backend

# Regenerate Prisma client to ensure it matches the latest schema
RUN npx prisma generate --schema=prisma/schema.prisma

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
