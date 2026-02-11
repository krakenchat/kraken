FROM node:25-slim

WORKDIR /app

# Copy root workspace config + shared and frontend package.json for dependency install
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY frontend/package.json ./frontend/

# Copy shared source before install so the prepare script can build it
COPY shared/ ./shared/

RUN npm install

# Copy frontend source
COPY frontend/ ./frontend/

WORKDIR /app/frontend

ENTRYPOINT ["./docker-entrypoint.sh"]

EXPOSE 5173

CMD ["npm", "run", "dev"]
