FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production=false

COPY . .
RUN npm run build

RUN mkdir -p /app/data

CMD ["node", "dist/index.js"]
