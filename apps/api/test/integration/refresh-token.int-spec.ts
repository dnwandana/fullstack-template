import { Test } from "@nestjs/testing"
import { PrismaModule } from "@core/database/prisma.module"
import { PrismaService } from "@core/database/prisma.service"
import { RefreshTokenService } from "@modules/auth/refresh-token.service"
import { UsersService } from "@modules/users/users.service"
import { truncateAll } from "@test/setup-e2e"

describe("RefreshTokenService", () => {
  let svc: RefreshTokenService
  let users: UsersService
  let prisma: PrismaService
  beforeAll(async () => {
    const ref = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [RefreshTokenService, UsersService],
    }).compile()
    svc = ref.get(RefreshTokenService)
    users = ref.get(UsersService)
    prisma = ref.get(PrismaService)
    await prisma.$connect()
  })
  beforeEach(async () => truncateAll(prisma))
  afterAll(async () => prisma.$disconnect())

  it("hashes deterministically to 64 hex chars", () => {
    const h = svc.hashToken("abc")
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(svc.hashToken("abc")).toBe(h)
  })

  it("persists, finds active, and revokes", async () => {
    const u = await users.create({ name: "R", email: "r@x.io", password: "h" })
    await svc.persist(u.id, "raw-token", new Date(Date.now() + 60000))
    const found = await svc.findActive("raw-token")
    expect(found).not.toBeNull()
    await svc.revoke(found!.id)
    expect(await svc.findActive("raw-token")).toBeNull()
  })

  it("parses durations", () => {
    const now = Date.now()
    expect(svc.expiryFromDuration("7d").getTime()).toBeGreaterThan(now + 6 * 86400000)
    expect(svc.expiryFromDuration("15m").getTime()).toBeGreaterThan(now + 14 * 60000)
  })
})
