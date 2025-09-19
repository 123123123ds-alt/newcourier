SHELL := /bin/bash

.PHONY: help install dev build lint format docker-up docker-down docker-logs

help:
	@echo "Available targets:"
	@echo "  install     Install dependencies via pnpm"
	@echo "  dev         Run all apps in development mode"
	@echo "  build       Build all apps"
	@echo "  lint        Lint all apps"
	@echo "  format      Format the repository with Prettier"
	@echo "  docker-up   Start the docker compose stack"
	@echo "  docker-down Stop the docker compose stack"
	@echo "  docker-logs Tail the logs from docker compose"

install:
	corepack enable pnpm && pnpm install

dev:
	pnpm dev

build:
	pnpm build

lint:
	pnpm lint

format:
	pnpm format

docker-up:
	docker compose up --build

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f
