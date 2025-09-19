# syntax=docker/dockerfile:1

FROM node:20-bullseye-slim AS base
WORKDIR /usr/src/app
ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
RUN corepack enable pnpm

COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --filter @newcourier/web... --prod=false

FROM base AS development
ENV NODE_ENV=development
COPY . .
CMD ["pnpm", "--filter", "@newcourier/web", "dev"]

FROM base AS build
ENV NODE_ENV=production
COPY . .
RUN pnpm --filter @newcourier/web build

FROM node:20-bullseye-slim AS production
WORKDIR /usr/src/app
ENV NODE_ENV=production
ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
RUN corepack enable pnpm
COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --filter @newcourier/web --prod --no-optional
COPY --from=build /usr/src/app/apps/web/.next ./apps/web/.next
COPY apps/web/public ./apps/web/public
COPY apps/web/next.config.js apps/web/next.config.js
EXPOSE 3000
CMD ["pnpm", "--filter", "@newcourier/web", "start"]
