SHELL := /bin/bash

.PHONY: dev down logs

.env:
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env from .env.example"; \
	fi

dev: .env
	@corepack enable pnpm
	@pnpm install
	@docker compose up -d
	@echo "Waiting for database to become ready..."
	@until docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; do \
		sleep 1; \
	done
	@pnpm --filter @newcourier/api prisma migrate deploy
	@pnpm --filter @newcourier/api prisma db seed
	@echo "NewCourier running at http://localhost:3000"

down:
	@docker compose down

logs:
	@docker compose logs -f
