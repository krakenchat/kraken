FROM node:24-slim

RUN corepack enable && corepack prepare pnpm@10.30.0 --activate

WORKDIR /app

# Copy root workspace config + shared and frontend package.json for dependency install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY shared/package.json ./shared/
COPY frontend/package.json ./frontend/

# Copy shared source before install so the prepare script can build it
COPY shared/ ./shared/

RUN pnpm install

# Copy frontend source
COPY frontend/ ./frontend/

WORKDIR /app/frontend

ENTRYPOINT ["./docker-entrypoint.sh"]

EXPOSE 5173

CMD ["pnpm", "run", "dev"]
