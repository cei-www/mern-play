# Convenience targets. The raw docker compose commands are documented in the README
# because Windows has no `make` by default.

.PHONY: setup up down restart logs ps

setup:            ## build all images (needs internet once)
	docker compose build

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
