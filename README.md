# NewCourier Monorepo

NewCourier is a pnpm based monorepo for a logistics platform that connects to the
ECCANG SOAP API. It contains a NestJS backend (`apps/api`) and a Next.js frontend
(`apps/web`) along with shared tooling that makes it easy to run the full stack in
local development or within Docker.

## Project structure

```
.
├── apps
│   ├── api          # NestJS + Prisma backend service
│   └── web          # Next.js App Router frontend
├── docker-compose.yml
├── Makefile
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## Requirements

- Node.js 20+
- pnpm (managed automatically through Corepack)
- Docker (optional but recommended for the one-click dev environment)

## Getting started

1. Copy `.env.example` to `.env` and adjust the values for your environment.
2. Install dependencies with `pnpm install`.
3. Run `pnpm dev` to start every workspace in development mode.

Each application also contains its own README with additional details.

### Helpful commands

| Command       | Description                                          |
| ------------- | ---------------------------------------------------- |
| `pnpm dev`    | Run all workspace apps in dev mode                    |
| `pnpm build`  | Build all workspace apps                              |
| `pnpm lint`   | Run linters across the workspace                      |
| `pnpm format` | Format files with Prettier                            |
| `make dev`    | Provision Docker services, run migrations and seed DB |
| `make down`   | Stop the Docker Compose stack                         |
| `make logs`   | Tail logs from the running Docker containers          |

## Docker development environment

The repository ships with a `docker-compose.yml` file that provisions PostgreSQL,
the NestJS API and the Next.js frontend. The stack can be bootstrapped with a
single command:

```bash
make dev
```

The API is exposed on port `4000`, the frontend on `3000`, and PostgreSQL on
`5432`. The compose configuration mounts the source code so that local changes
are reflected immediately. Running `make dev` will also copy `.env.example` to
`.env` (if missing), install dependencies, wait for PostgreSQL to be healthy,
apply migrations and seed the default administrator account.

## Environment variables

An `.env.example` file is provided with all environment variables required by the
stack, including ECCANG SOAP credentials, JWT settings, database connection
information and the frontend API base URL. Duplicate the file as `.env` before
running the applications.
