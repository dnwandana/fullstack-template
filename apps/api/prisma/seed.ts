import { PrismaClient } from "@prisma/client"
import { randomUUID } from "crypto"

// The 16 canonical permissions. Single source of truth — also consumed by
// test/setup-e2e.ts. MUST match the RBAC model documented in apps/api/CLAUDE.md.
export const PERMISSION_NAMES = [
  "org:read",
  "org:update",
  "org:delete",
  "org:manage_members",
  "org:manage_roles",
  "project:create",
  "project:read",
  "project:update",
  "project:delete",
  "project:manage_members",
  "todos:create",
  "todos:read",
  "todos:update",
  "todos:delete",
  "invitations:create",
  "invitations:manage",
] as const

export type PermissionName = (typeof PERMISSION_NAMES)[number]

// Descriptions copied verbatim from the pre-Prisma Knex seed
// (database/seeds/01_permissions.js) to preserve the original wording.
const PERMISSION_DESCRIPTIONS: Record<PermissionName, string> = {
  "org:read": "View organization details and settings",
  "org:update": "Update organization name, description, and settings",
  "org:delete": "Permanently delete the organization and all its data",
  "org:manage_members": "Add, remove, and change roles of organization members",
  "org:manage_roles": "Create, update, and delete custom roles within the organization",
  "project:create": "Create new projects within the organization",
  "project:read": "View project details, members, and settings",
  "project:update": "Update project name, description, and settings",
  "project:delete": "Permanently delete the project and all its todos",
  "project:manage_members": "Add, remove, and change roles of project members",
  "todos:create": "Create new todo items within a project",
  "todos:read": "View todo items within a project",
  "todos:update": "Update todo title, description, and completion status",
  "todos:delete": "Delete todo items from a project",
  "invitations:create": "Send invitations to join the organization or a project",
  "invitations:manage": "View, resend, and revoke pending invitations",
}

/**
 * Idempotently inserts the 16 canonical permissions. Upserts on the unique
 * `name` column, so repeated runs never raise a duplicate-key error. The
 * `resource`/`action` columns are required by the schema and derived from the
 * `resource:action` name convention.
 */
export async function seedPermissions(prisma: PrismaClient): Promise<void> {
  for (const name of PERMISSION_NAMES) {
    const [resource, action] = name.split(":")
    await prisma.permission.upsert({
      where: { name },
      update: {},
      create: {
        id: randomUUID(),
        name,
        description: PERMISSION_DESCRIPTIONS[name],
        resource,
        action,
      },
    })
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient()
  try {
    await seedPermissions(prisma)
    // eslint-disable-next-line no-console
    console.log(`Seeded ${PERMISSION_NAMES.length} permissions`)
  } finally {
    await prisma.$disconnect()
  }
}

// Run only when executed directly (e.g. `prisma db seed` → `node prisma/seed.ts`).
// Uses argv[1] rather than `require.main`/`import.meta` so the guard holds under
// both Node's ESM syntax-detection (direct run) and ts-jest's CommonJS (test import).
const entry = process.argv[1] ?? ""
if (entry.endsWith("seed.ts") || entry.endsWith("seed.js")) {
  void main()
}
