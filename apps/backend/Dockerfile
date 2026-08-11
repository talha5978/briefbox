# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.1.1 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY turbo.json ./
COPY tsconfig.json ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY packages ./packages
RUN pnpm install --frozen-lockfile --filter=@workspace/backend...

FROM base AS build
WORKDIR /app
COPY --from=deps /app /app
COPY apps/backend ./apps/backend
COPY packages ./packages
COPY tsconfig.json ./
COPY turbo.json ./
ENV NODE_ENV=production
RUN pnpm --filter=@workspace/backend build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@11.1.1 --activate

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/apps/backend ./apps/backend
COPY --from=build /app/packages ./packages
COPY --from=build /app/node_modules ./node_modules

WORKDIR /app/apps/backend
EXPOSE 4000
CMD ["pnpm", "start"]