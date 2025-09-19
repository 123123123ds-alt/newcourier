# syntax=docker/dockerfile:1

FROM node:20-bullseye-slim AS base
WORKDIR /usr/src/app
ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
RUN corepack enable pnpm

COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --filter @newcourier/api... --prod=false

FROM base AS development
ENV NODE_ENV=development
COPY . .
CMD ["pnpm", "--filter", "@newcourier/api", "dev"]

FROM base AS build
ENV NODE_ENV=production
COPY . .
RUN pnpm --filter @newcourier/api build

FROM node:20-bullseye-slim AS production
WORKDIR /usr/src/app
ENV NODE_ENV=production
ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
RUN corepack enable pnpm
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --filter @newcourier/api --prod --no-optional
COPY --from=build /usr/src/app/apps/api/dist ./apps/api/dist
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
