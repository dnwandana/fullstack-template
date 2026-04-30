FROM node:24-alpine
RUN corepack enable pnpm

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/

RUN pnpm install --filter @fullstack/api --prod --frozen-lockfile

COPY apps/api/src ./apps/api/src
COPY apps/api/knexfile.js ./apps/api/knexfile.js
COPY apps/api/database ./apps/api/database

WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 3000
USER node
CMD ["node", "src/index.js"]
