import { config } from "dotenv"
import { resolve } from "path"
import { execSync } from "child_process"
import type { PrismaClient } from "@prisma/client"
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
    "TRUNCATE TABLE refresh_tokens, invitations, todos, project_members, projects, org_members, role_permissions, roles, organizations, users CASCADE",
  )
}
