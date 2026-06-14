# Build stage — compile TypeScript to dist/.
FROM node:20-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-package-lock --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Runtime stage — no dependencies, just Node + the compiled output.
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY package.json ./
# Cloud Run sets PORT (8080) and routes traffic to it.
CMD ["node", "dist/server.js"]
