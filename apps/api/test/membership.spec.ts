import { Test } from "@nestjs/testing"
import { PrismaModule } from "../src/prisma/prisma.module"
import { PrismaService } from "../src/prisma/prisma.service"
import { MembershipService } from "../src/tenancy/membership.service"
import { UsersService } from "../src/users/users.service"
import { truncateAll } from "./setup-e2e"
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
