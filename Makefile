# Convenience targets. The raw docker compose commands are documented in docs/GUIDE.md
# because Windows has no `make` by default. Development targets need Docker only (Node 22 runs in a container).

NODE = docker run --rm -v "$(CURDIR)":/repo
IMG  = node:22-bookworm-slim

.PHONY: setup up down restart logs ps robot robot-stop reset test lint-lessons snapshots snapshots-check integration lint format format-check

setup:            ## build all images (needs internet once)
	docker compose build
	docker compose --profile robot build ws-robot

up:               ## start the stack
	docker compose up -d

down:             ## stop and remove containers (volumes are kept)
	docker compose down

restart:          ## restart the workspace processes
	docker compose restart ws-main

logs:
	docker compose logs -f --tail=100

ps:
	docker compose ps

robot:            ## start the Robot container (module api)
	docker compose --profile robot up --no-start ws-robot
	docker compose start ws-robot

robot-stop:
	docker compose stop ws-robot

reset:            ## DELETE all containers, workspaces and database data, then start again
	docker compose --profile robot down -v
	docker compose up -d --build

# ---- for course authors and contributors ----

test:             ## unit tests and type checks of the three TypeScript/JavaScript packages
	$(NODE) -w /repo/workspace/tutorial-cli $(IMG) sh -c 'npx tsc -p tsconfig.json --noEmit && npx vitest run'
	$(NODE) -w /repo/platform/api $(IMG) sh -c 'npx tsc -p tsconfig.json --noEmit && npx vitest run'
	$(NODE) -w /repo/platform/ui $(IMG) sh -c 'npx tsc -p tsconfig.json --noEmit && npx vitest run'

lint-lessons:     ## check every lesson against lesson.yaml, the OpenAPI file and the finished app
	$(NODE) -w /repo/platform/api $(IMG) sh -c 'npx tsc -p tsconfig.build.json --outDir /tmp/dist >/dev/null && ln -s /repo/platform/api/node_modules /tmp/node_modules && printf "{\"type\":\"module\"}" > /tmp/package.json && node /tmp/dist/lintCli.js /repo/course --solution /repo/workspace/project-template --solution /repo/course/solution'

snapshots:        ## rebuild course/snapshots from the finished app
	workspace/tutorial-cli/snapshots.sh

snapshots-check:  ## fail when course/snapshots is out of date
	workspace/tutorial-cli/snapshots.sh --check

integration:      ## boot a private stack, play a learner through the course, tear it down (about 2 minutes)
	tests/integration/run.sh

# ESLint and Prettier for the tools of this repository (tools/lint). Not applied to the learner project, lessons or snapshots.
TARGETS = workspace/tutorial-cli platform tests
BIN = tools/lint/node_modules/.bin
# Installs the lint tools on first use, then runs the command given as $(1).
inlint = $(NODE) -w /repo $(IMG) sh -c 'test -d tools/lint/node_modules || (cd tools/lint && npm install --no-audit --no-fund >/dev/null 2>&1); $(1)'

lint:             ## ESLint
	$(call inlint,$(BIN)/eslint -c tools/lint/eslint.config.js $(TARGETS))

format:           ## Prettier: rewrite the files of the tools
	$(call inlint,$(BIN)/prettier --config .prettierrc.json --write $(TARGETS))

format-check:     ## Prettier: fail when a file is not formatted
	$(call inlint,$(BIN)/prettier --config .prettierrc.json --check $(TARGETS))
