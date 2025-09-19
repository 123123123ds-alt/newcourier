# NewCourier API

This NestJS service exposes the backend APIs for the NewCourier platform. It uses
Prisma with PostgreSQL for persistence and integrates with the ECCANG SOAP API to
manage shipments.

## Available scripts

| Command            | Description                         |
| ------------------ | ----------------------------------- |
| `pnpm dev`         | Start the development server        |
| `pnpm build`       | Compile the application             |
| `pnpm start`       | Run the compiled application        |
| `pnpm lint`        | Lint source files with ESLint       |
| `pnpm prisma:generate` | Generate Prisma client (via `pnpm prisma generate`) |

## Environment

The service expects the environment variables defined in `.env.example` at the
repository root, including database connection settings and ECCANG credentials.
