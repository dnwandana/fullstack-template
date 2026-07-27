import { config } from "dotenv"
import { resolve } from "path"
import { execSync } from "child_process"
import type { PrismaClient } from "@prisma/client"
import type Redis from "ioredis"
import { seedPermissions } from "../prisma/seed"

// Re-export the canonical seeder so e2e suites share ONE implementation with the
// CLI seed. It upserts per name, so it self-heals a partial permission table
// (e.g. after a new permission is added) — the old count>0 guard silently didn't.
export { seedPermissions }

export default async function globalSetup(): Promise<void> {
  config({ path: resolve(__dirname, "../.env.test"), override: true })

  // Ensure the schema is present on the test database.
  execSync("pnpm exec prisma migrate deploy", {
    cwd: resolve(__dirname, ".."),
    stdio: "inherit",
    env: process.env,
  })

  // Seed immutable permission rows once.
  const { PrismaClient } = await import("@prisma/client")
  const prisma = new PrismaClient()
  await seedPermissions(prisma)
  await prisma.$disconnect()
}

export async function truncateAll(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    "TRUNCATE TABLE password_reset_tokens, refresh_tokens, invitations, todos, project_members, projects, org_members, role_permissions, roles, organizations, users CASCADE",
  )
}

// Companion to truncateAll: Redis holds throttle counters and queued notification
// jobs, and neither is reset by TRUNCATE. A leftover counter makes the *next*
// suite's first signin 429 — deterministic under maxWorkers: 1, and attributed to
// the wrong suite. Leftover `bull:notifications:*` jobs are picked up by the next
// suite's worker.
//
// flushdb, not flushall: flushall ignores the connection's database selection and
// would clear db 0 as well, wiping a developer's local queue and rate-limit state
// with no warning. .env.test pins REDIS_URL to db 1, and
// redis-isolation.e2e-spec.ts asserts that — it is the only automated guard on
// this helper.
//
// Unlike truncateAll, individual suites do NOT call this. test/reset-redis-state.ts
// is registered as `setupFilesAfterEnv` in test/jest-e2e.json and calls it from a
// root beforeEach, so Redis is empty at the start of every e2e test. That is the
// single answer to "what resets throttle counters between tests"; adding a
// per-suite call would be a second, redundant one. It is exported for suites that
// need to flush *mid*-test — throttler-storage.e2e-spec.ts counts keys written
// after a known-empty starting point.
export async function flushRedis(redis: Redis): Promise<void> {
  await redis.flushdb()
}
