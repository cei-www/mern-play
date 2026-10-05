#!/usr/bin/env bash
# First-run init for the learner workspace, then hand over to the main process.
# Safe to run on every start: a module directory is only populated while it has no
# `.initialized` marker, so learner work is never overwritten.
set -euo pipefail

TEMPLATES=/opt/templates
MODULES=/opt/modules

init_module() {
  local name=$1
  local dest=/workspace/$name
  if [ -d "$TEMPLATES/$name" ] && [ ! -f "$dest/.initialized" ]; then
    echo "[init] populating $dest"
    mkdir -p "$dest"
    cp -a "$TEMPLATES/$name/." "$dest/"
    touch "$dest/.initialized"
  fi
}

# Dependencies live in the image (offline, no installs at runtime); each project links to them.
link_deps() {
  local name=$1
  local sub
  # A project with its package.json at the top (module unit) links node_modules there.
  if [ -f "$MODULES/$name/package.json" ] && [ -d "$MODULES/$name/node_modules" ] && [ -d "/workspace/$name" ]; then
    ln -sfn "$MODULES/$name/node_modules" "/workspace/$name/node_modules"
  fi
  for sub in server client; do
    if [ -d "$MODULES/$name/$sub/node_modules" ] && [ -d "/workspace/$name/$sub" ]; then
      ln -sfn "$MODULES/$name/$sub/node_modules" "/workspace/$name/$sub/node_modules"
    fi
  done
}

# Which modules this container serves (ws-main: build and style; ws-robot: api).
for module in ${INIT_MODULES:-build}; do
  init_module "$module"
  link_deps "$module"
done

# ws-robot: wait for MySQL (it is started by hand, so depends_on is not used) and prepare the report folder.
if [ -n "${WAIT_FOR_DB:-}" ]; then
  until mysqladmin ping -h "${TUTORIAL_DB_HOST:-db}" -u"${TUTORIAL_DB_USER}" -p"${TUTORIAL_DB_PASSWORD}" --silent 2>/dev/null; do
    echo "[init] waiting for the database..."
    sleep 2
  done
fi
if [ -d /workspace/api ]; then mkdir -p /workspace/api/results; fi

exec "$@"
