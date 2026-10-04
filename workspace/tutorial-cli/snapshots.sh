#!/bin/sh
# Course author tool. Rebuilds course/snapshots/build from the finished app, using Docker (Node 22).
#   workspace/tutorial-cli/snapshots.sh           write the snapshots
#   workspace/tutorial-cli/snapshots.sh --check   fail when they are out of date
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
docker run --rm -v "$ROOT":/repo -w /repo/workspace/tutorial-cli node:22-bookworm-slim sh -c '
  npx tsc -p tsconfig.build.json --outDir /tmp/dist >/dev/null
  ln -s /repo/workspace/tutorial-cli/node_modules /tmp/node_modules
  printf "{\"type\":\"module\"}" > /tmp/package.json
  node /tmp/dist/buildSnapshots.js --app /repo/workspace/project-template/build --course /repo/course --module build '"$*"
