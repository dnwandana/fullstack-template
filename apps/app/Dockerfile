# Stage 1: build Vue app
FROM node:24-alpine AS builder
RUN corepack enable pnpm

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/app/package.json ./apps/app/
COPY packages/contracts/package.json ./packages/contracts/

# `@fullstack/app...` (trailing ellipsis) includes the workspace deps. Without it the
# filtered install omits @fullstack/contracts and the workspace: specifier cannot resolve.
RUN pnpm install --filter @fullstack/app... --frozen-lockfile

COPY apps/app ./apps/app
COPY packages/contracts ./packages/contracts

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Contracts emits only .d.ts, but vue-tsc (now part of the app build) needs it on disk.
RUN pnpm --filter @fullstack/contracts build
RUN pnpm --filter @fullstack/app build

# Stage 2: serve with nginx
FROM nginx:1.30-alpine
COPY apps/app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/app/dist /usr/share/nginx/html
EXPOSE 80
