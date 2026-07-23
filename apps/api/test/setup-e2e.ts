import { config } from "dotenv"
import { resolve } from "path"
import { execSync } from "child_process"
import type { PrismaClient } from "@prisma/client"

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
  const count = await prisma.permission.count()
  if (count === 0) {
    const defs = [
      ["org", "read"],
      ["org", "update"],
      ["org", "delete"],
      ["org", "manage_members"],
      ["org", "manage_roles"],
      ["project", "create"],
      ["project", "read"],
      ["project", "update"],
      ["project", "delete"],
      ["project", "manage_members"],
      ["todos", "create"],
      ["todos", "read"],
      ["todos", "update"],
      ["todos", "delete"],
      ["invitations", "create"],
      ["invitations", "manage"],
    ] as const
    const { randomUUID } = await import("crypto")
    await prisma.permission.createMany({
      data: defs.map(([resource, action]) => ({
        id: randomUUID(),
        name: `${resource}:${action}`,
        description: `${action} ${resource}`,
        resource,
        action,
      })),
    })
  }
  await prisma.$disconnect()
}

export async function truncateAll(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    "TRUNCATE TABLE refresh_tokens, invitations, todos, project_members, projects, org_members, role_permissions, roles, organizations, users CASCADE",
  )
}

const PERMISSION_DEFS = [
  ["org", "read"],
  ["org", "update"],
  ["org", "delete"],
  ["org", "manage_members"],
  ["org", "manage_roles"],
  ["project", "create"],
  ["project", "read"],
  ["project", "update"],
  ["project", "delete"],
  ["project", "manage_members"],
  ["todos", "create"],
  ["todos", "read"],
  ["todos", "update"],
  ["todos", "delete"],
  ["invitations", "create"],
  ["invitations", "manage"],
] as const

/**
 * Seeds the 16 immutable permission rows. Idempotent — a no-op when the rows
 * already exist (they survive truncateAll, which excludes the permissions
 * table), so e2e suites can safely call it in beforeEach.
 */
export async function seedPermissions(prisma: PrismaClient): Promise<void> {
  const count = await prisma.permission.count()
  if (count > 0) return
  const { randomUUID } = await import("crypto")
  await prisma.permission.createMany({
    data: PERMISSION_DEFS.map(([resource, action]) => ({
      id: randomUUID(),
      name: `${resource}:${action}`,
      description: `${action} ${resource}`,
      resource,
      action,
    })),
  })
}
