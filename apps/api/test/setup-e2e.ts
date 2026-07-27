import { config } from "dotenv"
import { resolve } from "path"
import { execSync } from "child_process"
import type { PrismaClient } from "@prisma/client"
import type Redis from "ioredis"
import { seedPermissions } from "../prisma/seed"

// Re-exported so e2e suites share ONE seeder implementation with the CLI seed. It upserts per
// name, so it self-heals a partial permission table (e.g. after a new permission is added) —
// the old count>0 guard silently didn't.
export { seedPermissions }

/**
 * Jest `globalSetup`: applies migrations and seeds the permission rows once per run, before any
 * suite starts.
 */
export default async function globalSetup(): Promise<void> {
  config({ path: resolve(__dirname, "../.env.test"), override: true })

  execSync("pnpm exec prisma migrate deploy", {
    cwd: resolve(__dirname, ".."),
    stdio: "inherit",
    env: process.env,
  })

  const { PrismaClient } = await import("@prisma/client")
  const prisma = new PrismaClient()
  await seedPermissions(prisma)
  await prisma.$disconnect()
}

/**
 * Truncates every tenant table. Each spec must call this itself — PostgreSQL has no automatic
 * per-test reset, and a spec that omits the call silently leaks its rows into the next one.
 */
export async function truncateAll(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    "TRUNCATE TABLE password_reset_tokens, refresh_tokens, invitations, todos, project_members, projects, org_members, role_permissions, roles, organizations, users CASCADE",
  )
}

// Companion to truncateAll: TRUNCATE resets neither throttle counters nor queued notification
// jobs. A leftover counter 429s the *next* suite's first signin — deterministic under
// maxWorkers: 1, and blamed on the wrong suite — and leftover bull jobs run in its worker.

// flushdb, not flushall: flushall ignores the connection's database selection and would clear
// db 0 too, wiping a developer's local queue and rate-limit state with no warning. .env.test
// pins REDIS_URL to db 1, and redis-isolation.e2e-spec.ts is the only automated guard on that.

/**
 * Unlike truncateAll, suites do NOT call this: test/reset-redis-state.ts calls it from a root
 * beforeEach, so Redis is already empty at the start of every e2e test and a per-suite call
 * would be redundant. Exported for suites flushing mid-test (throttler-storage.e2e-spec.ts).
 */
export async function flushRedis(redis: Redis): Promise<void> {
  await redis.flushdb()
}
