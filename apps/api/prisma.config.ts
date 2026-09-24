import { config } from "dotenv"
import { defineConfig, env } from "prisma/config"

// The runtime image runs `prisma migrate deploy` and `prisma db seed`, so dotenv is a production
// dependency. `quiet` stops the dotenv 18 banner on stderr of every Prisma command.
config({ quiet: true })

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // The seed imports the generated client, which is TypeScript source. Node cannot run it, so
    // the seed runs from the compiled output. Build first: `corepack pnpm db:seed` does this.
    seed: "node dist/seed.js",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
})
