import { Test } from "@nestjs/testing"
import { PrismaModule } from "@core/database/prisma.module"
import { PrismaService } from "@core/database/prisma.service"
import { MembershipService } from "@tenancy/membership.service"
import { UsersService } from "@modules/users/users.service"
import { truncateAll } from "@test/setup-e2e"
import { randomUUID } from "crypto"

describe("MembershipService", () => {
  let svc: MembershipService
  let users: UsersService
  let prisma: PrismaService
  beforeAll(async () => {
    const ref = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [MembershipService, UsersService],
    }).compile()
    svc = ref.get(MembershipService)
    users = ref.get(UsersService)
    prisma = ref.get(PrismaService)
    await prisma.$connect()
  })
  beforeEach(async () => truncateAll(prisma))
  afterAll(async () => prisma.$disconnect())

  it("reports not-found for a missing org", async () => {
    const u = await users.create({ name: "A", email: "a@x.io", password: "h" })
    const res = await svc.resolveOrg(u.id, randomUUID())
    expect(res.found).toBe(false)
    expect(res.org).toBeNull()
  })
})
