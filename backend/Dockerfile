FROM node:22-slim

# Install procps to provide 'ps' command (for local dev)
RUN apt-get update -y && apt-get install -y openssl
RUN apt-get install -y procps && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm install

COPY . .

# Install nodemon for development
RUN npm install --save-dev nodemon

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
