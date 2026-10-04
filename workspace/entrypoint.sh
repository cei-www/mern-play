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
  for sub in server client; do
    if [ -d "$MODULES/$name/$sub/node_modules" ] && [ -d "/workspace/$name/$sub" ]; then
      ln -sfn "$MODULES/$name/$sub/node_modules" "/workspace/$name/$sub/node_modules"
    fi
  done
}

init_module build
link_deps build

exec "$@"
