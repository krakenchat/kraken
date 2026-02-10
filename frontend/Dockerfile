FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENTRYPOINT ["./docker-entrypoint.sh"]

EXPOSE 5173

CMD ["npm", "run", "dev"]
