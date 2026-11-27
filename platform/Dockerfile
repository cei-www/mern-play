# syntax=docker/dockerfile:1
# Platform: serves the tutorial UI and lessons and reports service status. No commands reach the workspaces.
FROM node:22-bookworm-slim AS build
# npm 10 from the Node 22 image crashes on vitest peer resolution when no lockfile is copied; npm 12 resolves it.
RUN npm install -g npm@12.2.3 --no-audit --no-fund
WORKDIR /api
# The lockfile is copied so npm ci resolves nothing at install time (npm 10 from the image crashes on fresh peer resolution).
COPY api/package.json api/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY api/tsconfig.json api/tsconfig.build.json ./
COPY api/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /api/package.json ./package.json
COPY --from=build /api/node_modules ./node_modules
COPY --from=build /api/dist ./dist
# The UI (platform/ui) and the course are mounted by docker-compose, so editing them needs no rebuild.
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
