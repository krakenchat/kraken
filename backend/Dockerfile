FROM node:22-slim

# Install procps to provide 'ps' command (for local dev)
# Install ffmpeg for video clip processing
RUN apt-get update -y && apt-get install -y openssl ffmpeg procps && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm install

COPY . .

# Install nodemon for development
RUN npm install --save-dev nodemon

# Regenerate Prisma client to ensure it matches the latest schema
RUN npx prisma generate --schema=prisma/schema.prisma

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
