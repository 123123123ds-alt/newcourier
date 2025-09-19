SHELL := /bin/bash

.PHONY: help install dev build lint format docker-up docker-down docker-logs down logs

.env:
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env from .env.example"; \
	fi

help:
	@echo "Available targets:"
	@echo "  install       Install dependencies via pnpm"
	@echo "  dev           Provision Docker services, run migrations, seed data"
	@echo "  build         Build all workspace apps"
	@echo "  lint          Lint all workspace apps"
	@echo "  format        Format the repository with Prettier"
	@echo "  docker-up     Build and start the docker compose stack"
	@echo "  docker-down   Stop the docker compose stack"
	@echo "  docker-logs   Tail logs from docker compose"
	@echo "  down          Alias for docker-down"
	@echo "  logs          Alias for docker-logs"

install:
	@corepack enable pnpm
	@pnpm install

dev: .env
	@$(MAKE) install
	@docker compose up -d
	@echo "Waiting for database to become ready..."
	@until docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; do \
		sleep 1; \
	done
	@pnpm --filter @newcourier/api prisma migrate deploy
	@pnpm --filter @newcourier/api prisma db seed
	@echo "NewCourier running at http://localhost:3000"

build:
	@pnpm build

lint:
	@pnpm lint

format:
	@pnpm format

docker-up:
	docker compose up --build

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

down: docker-down

logs: docker-logs
