FROM node:20-slim

WORKDIR /app

# Copy package files and install all dependencies (including dev for build)
COPY package.json ./
RUN npm install

# Copy source and build TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
