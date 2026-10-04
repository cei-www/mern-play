# syntax=docker/dockerfile:1
# Platform: serves the tutorial UI and lessons and reports service status. No commands reach the workspaces.
FROM node:22-bookworm-slim AS build
WORKDIR /api
COPY api/package.json ./
RUN npm install --no-audit --no-fund
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
