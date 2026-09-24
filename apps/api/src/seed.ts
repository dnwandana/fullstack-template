import { randomUUID } from "crypto"
// Relative imports, not aliases: Jest loads this file from test/setup-e2e.ts, and Jest's
// globalSetup does not apply moduleNameMapper.
import { PrismaClient } from "./generated/prisma/client"
import { createPrismaAdapter } from "./core/database/prisma-adapter"

/**
 * The canonical permission set, also consumed by test/setup-e2e.ts. Must hold exactly the same
 * names as ALL_PERMISSIONS in src/modules/orgs/system-roles.ts. The unit spec beside that file,
 * src/modules/orgs/__tests__/system-roles.spec.ts, compares the two sorted and fails on a
 * name that appears in only one.
 */
export const PERMISSION_NAMES = [
  "org:read",
  "org:update",
  "org:delete",
  "org:manage_members",
  "org:manage_roles",
  "project:create",
  "project:read",
  "project:read_all",
  "project:update",
  "project:delete",
  "project:manage_members",
  "todos:create",
  "todos:read",
  "todos:update",
  "todos:delete",
  "invitations:create",
  "invitations:manage",
  "audit:read",
] as const

export type PermissionName = (typeof PERMISSION_NAMES)[number]

// Copied verbatim from the original pre-Prisma Knex seed (since removed) to keep the wording.
const PERMISSION_DESCRIPTIONS: Record<PermissionName, string> = {
  "org:read": "View organization details and settings",
  "org:update": "Update organization name, description, and settings",
  "org:delete": "Permanently delete the organization and all its data",
  "org:manage_members": "Add, remove, and change roles of organization members",
  "org:manage_roles": "Create, update, and delete custom roles within the organization",
  "project:create": "Create new projects within the organization",
  "project:read": "View project details, members, and settings",
  "project:read_all": "View all projects in the organization, not only those you belong to",
  "project:update": "Update project name, description, and settings",
  "project:delete": "Permanently delete the project and all its todos",
  "project:manage_members": "Add, remove, and change roles of project members",
  "todos:create": "Create new todo items within a project",
  "todos:read": "View todo items within a project",
  "todos:update": "Update todo title, description, and completion status",
  "todos:delete": "Delete todo items from a project",
  "invitations:create": "Send invitations to join the organization or a project",
  "invitations:manage": "View, resend, and revoke pending invitations",
  "audit:read": "Read the org audit log page and endpoint",
}

/**
 * Idempotently inserts the canonical permissions, upserting on the unique `name` column so
 * repeated runs never raise a duplicate-key error. `resource`/`action` are required by the
 * schema and derived from the `resource:action` name convention.
 */
export async function seedPermissions(prisma: PrismaClient): Promise<void> {
  for (const name of PERMISSION_NAMES) {
    const [resource, action] = name.split(":")
    // `resource`/`action` are non-null columns. A name missing its `:` would otherwise
    // reach Prisma as `undefined` and fail as an opaque driver error naming the column,
    // not the permission — throw here so the malformed entry identifies itself.
    if (resource === undefined || action === undefined) {
      throw new Error(`Malformed permission name "${name}" — expected "<resource>:<action>"`)
    }
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
  // `prisma db seed` passes on the environment that prisma.config.ts loaded from .env.
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("Seed failed: DATABASE_URL is not set. Set it in .env or the shell.")
  const prisma = new PrismaClient({ adapter: createPrismaAdapter(url) })
  try {
    await seedPermissions(prisma)
    // eslint-disable-next-line no-console
    console.log(`Seeded ${PERMISSION_NAMES.length} permissions`)
  } finally {
    await prisma.$disconnect()
  }
}

// Run only when executed directly (`prisma db seed` runs `node dist/seed.js`), not when a test
// imports this file for `seedPermissions`.
if (require.main === module) {
  void main()
}
