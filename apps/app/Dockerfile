# Stage 1: build Vue app
FROM node:24-alpine AS builder
RUN corepack enable pnpm

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/app/package.json ./apps/app/

RUN pnpm install --filter @fullstack/app --frozen-lockfile

COPY apps/app ./apps/app

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN pnpm --filter @fullstack/app build

# Stage 2: serve with nginx
FROM nginx:1.30-alpine
COPY --from=builder /app/apps/app/dist /usr/share/nginx/html
EXPOSE 80 443
