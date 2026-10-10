#!/bin/sh
# Runs inside the tools container (docker-compose.tools.yml). Rebuilds course/snapshots/<module> from the finished app of each module:
#   build: workspace/project-template/build (it is also the starting project)
#   style: course/solution/style (its starting project, workspace/project-template/style, is generated from it)
# Pass --check to fail when they are out of date instead of writing them.
set -e
cd /repo/workspace/tutorial-cli
npx tsc -p tsconfig.build.json --outDir /tmp/dist >/dev/null
ln -sfn /repo/workspace/tutorial-cli/node_modules /tmp/node_modules
printf '{"type":"module"}' > /tmp/package.json
node /tmp/dist/buildSnapshots.js --app /repo/workspace/project-template/build --course /repo/course --module build "$@"
node /tmp/dist/buildSnapshots.js --app /repo/course/solution/style --course /repo/course --module style --template /repo/workspace/project-template/style "$@"
