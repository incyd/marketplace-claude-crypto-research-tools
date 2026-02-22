FROM node:20-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm install --save-dev typescript tsx @types/node @types/express && npm run build

# Remove dev dependencies after build
RUN npm ci --omit=dev

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
