#!/bin/sh
# Boots a private copy of the stack (project "ce-it", other host ports), runs the integration test, tears it down.
# Needs Docker and Node 18+. The first run builds the images.
set -e
cd "$(dirname "$0")/../.."
export WS_MAIN_PORT=18081 EXPRESS_PORT=13000 VITE_PORT=15173
docker compose -p ce-it up -d --build --wait db ws-main
status=0
node tests/integration/run.mjs || status=$?
if [ "${KEEP:-}" = "1" ]; then echo "Stack left running (KEEP=1): docker compose -p ce-it down -v"; else docker compose -p ce-it down -v >/dev/null 2>&1; fi
exit $status
