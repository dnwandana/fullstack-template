import { PrismaClient } from "@prisma/client"
import { seedPermissions, PERMISSION_NAMES } from "../../prisma/seed"

describe("seed", () => {
  const prisma = new PrismaClient()
  beforeAll(async () => prisma.$connect())
  afterAll(async () => {
    // This suite truncates the shared permissions table; leave it fully seeded
    // so later suites (which rely on the rows surviving truncateAll) still find
    // all 17 — even if an assertion above threw.
    await seedPermissions(prisma)
    await prisma.$disconnect()
  })

  it("inserts the 17 permissions idempotently", async () => {
    await prisma.$executeRawUnsafe("TRUNCATE TABLE role_permissions, permissions CASCADE")
    await seedPermissions(prisma)
    await seedPermissions(prisma) // idempotent — no duplicate-key error

    const rows = await prisma.permission.findMany()
    expect(rows).toHaveLength(PERMISSION_NAMES.length)
    // Every canonical name is present exactly once.
    expect(new Set(rows.map((r) => r.name))).toEqual(new Set(PERMISSION_NAMES))
    // resource/action are derived from the `resource:action` name convention.
    const orgRead = rows.find((r) => r.name === "org:read")
    expect(orgRead).toMatchObject({ resource: "org", action: "read" })
    expect(orgRead?.description).toBeTruthy()
  })
})
