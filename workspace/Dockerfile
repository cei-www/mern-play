# syntax=docker/dockerfile:1
# Workspace images. Built for amd64 and arm64 (TARGETARCH is set by BuildKit).
#   base : Node, code-server, supervisor, MySQL client, pre-installed VS Code extensions
#   main : base + the dependencies and project template for modules build/style/unit (ws-main)
# Everything is installed at build time so the running workspace needs no internet.

FROM node:22-bookworm-slim AS cli-build
WORKDIR /cli
COPY tutorial-cli/package.json ./
RUN npm install --no-audit --no-fund
COPY tutorial-cli/tsconfig.json tutorial-cli/tsconfig.build.json ./
COPY tutorial-cli/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS base
ARG TARGETARCH
ARG CODE_SERVER_VERSION=4.140.0
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git supervisor mariadb-client procps \
 && curl -fsSL -o /tmp/code-server.deb \
      "https://github.com/coder/code-server/releases/download/v${CODE_SERVER_VERSION}/code-server_${CODE_SERVER_VERSION}_${TARGETARCH}.deb" \
 && apt-get install -y /tmp/code-server.deb \
 && rm -rf /tmp/code-server.deb /var/lib/apt/lists/*

# The base image already has a non-root user "node" (uid 1000); the learner runs as that user.
RUN mkdir -p /opt/code-server/extensions /opt/modules /opt/templates \
             /workspace/build /workspace/style /workspace/unit \
             /home/node/.local/share/code-server/User \
 && chown -R node:node /opt/code-server /opt/modules /opt/templates /workspace /home/node

USER node
RUN code-server --extensions-dir /opt/code-server/extensions \
      --install-extension humao.rest-client \
      --install-extension cweijan.vscode-mysql-client2 \
      --install-extension dbaeumer.vscode-eslint \
      --install-extension esbenp.prettier-vscode
COPY --chown=node:node code-server-settings.json /home/node/.local/share/code-server/User/settings.json
COPY --chown=node:node entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
# The `tutorial` command the learner types in the VS Code terminal (no runtime dependencies).
COPY --from=cli-build --chown=node:node /cli/dist /opt/tutorial/dist
COPY --from=cli-build --chown=node:node /cli/node_modules /opt/tutorial/node_modules
RUN printf '{"type":"module"}\n' > /opt/tutorial/package.json
COPY --chmod=0755 bin/tutorial bin/reset-db /usr/local/bin/

# ---------------------------------------------------------------------------
FROM base AS main
USER node
RUN mkdir -p /opt/modules/build/server /opt/modules/build/client

# Dependencies for the "build" module (installed once, linked into /workspace at start).
COPY --chown=node:node project-template/build/server/package.json /opt/modules/build/server/package.json
COPY --chown=node:node project-template/build/client/package.json /opt/modules/build/client/package.json
RUN cd /opt/modules/build/server && npm install --no-audit --no-fund \
 && cd /opt/modules/build/client && npm install --no-audit --no-fund

COPY --chown=node:node project-template/build /opt/templates/build
COPY --chown=root:root supervisord-main.conf /etc/supervisor/ce-main.conf

WORKDIR /workspace
EXPOSE 8080 3000 5173
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["supervisord", "-n", "-c", "/etc/supervisor/ce-main.conf"]
