import { Test } from "@nestjs/testing"
import { PrismaModule } from "../src/prisma/prisma.module"
import { PrismaService } from "../src/prisma/prisma.service"
import { OrgsService } from "../src/orgs/orgs.service"
import { UsersService } from "../src/users/users.service"
import { truncateAll, seedPermissions } from "./setup-e2e"

describe("OrgsService.createWithSystemRoles", () => {
  let orgs: OrgsService
  let users: UsersService
  let prisma: PrismaService
  beforeAll(async () => {
    const ref = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [OrgsService, UsersService],
    }).compile()
    orgs = ref.get(OrgsService)
    users = ref.get(UsersService)
    prisma = ref.get(PrismaService)
    await prisma.$connect()
  })
  beforeEach(async () => {
    await truncateAll(prisma)
    await seedPermissions(prisma)
  })
  afterAll(async () => {
    // Restore the full permission set for later suites (seedPermissions only
    // inserts when the table is empty), then disconnect.
    await prisma.permission.deleteMany({})
    await seedPermissions(prisma)
    await prisma.$disconnect()
  })

  it("fails loudly when a system-role permission is missing from the database", async () => {
    const u = await users.create({ name: "A", email: "a@x.io", password: "h" })
    await prisma.permission.deleteMany({ where: { name: "todos:read" } })
    await expect(orgs.createWithSystemRoles(u.id, { name: "Acme" })).rejects.toThrow(/permission/i)
    // The transaction must roll back — no partial org is left behind.
    expect(await prisma.organization.count()).toBe(0)
  })
})
