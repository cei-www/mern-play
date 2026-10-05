#!/bin/sh
# Boots a private copy of the stack (project "ce-it", other host ports), runs the integration tests, tears it down.
#   tests/integration/run.sh          all modules (build, style, unit, api)
#   ONLY=build tests/integration/run.sh   or   ONLY=api   or   ONLY=style   or   ONLY=unit
# Needs Docker and Node 18+. The first run builds the images.
set -e
cd "$(dirname "$0")/../.."
export WS_MAIN_PORT=18081 EXPRESS_PORT=13000 VITE_PORT=15173 STYLE_API_PORT=13002 VITE_STYLE_PORT=15174
export WS_ROBOT_PORT=18083 REFERENCE_API_PORT=13001 ROBOT_REPORT_PORT=19323
docker compose -p ce-it --profile robot up -d --build --wait db ws-main ws-robot
status=0
if [ -z "${ONLY:-}" ] || [ "$ONLY" = "build" ]; then node tests/integration/run.mjs || status=$?; fi
if [ -z "${ONLY:-}" ] || [ "$ONLY" = "style" ]; then node tests/integration/run-style.mjs || status=$?; fi
if [ -z "${ONLY:-}" ] || [ "$ONLY" = "unit" ]; then node tests/integration/run-unit.mjs || status=$?; fi
if [ -z "${ONLY:-}" ] || [ "$ONLY" = "api" ]; then node tests/integration/run-api.mjs || status=$?; fi
if [ "${KEEP:-}" = "1" ]; then echo "Stack left running (KEEP=1): docker compose -p ce-it --profile robot down -v"; else docker compose -p ce-it --profile robot down -v >/dev/null 2>&1; fi
exit $status
