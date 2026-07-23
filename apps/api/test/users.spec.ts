import { Test } from "@nestjs/testing"
import { UsersService } from "../src/users/users.service"
import { PrismaService } from "../src/prisma/prisma.service"
import { PrismaModule } from "../src/prisma/prisma.module"
import { truncateAll } from "./setup-e2e"

describe("UsersService", () => {
  let users: UsersService
  let prisma: PrismaService

  beforeAll(async () => {
    const ref = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [UsersService],
    }).compile()
    users = ref.get(UsersService)
    prisma = ref.get(PrismaService)
    await prisma.$connect()
  })
  beforeEach(async () => truncateAll(prisma))
  afterAll(async () => prisma.$disconnect())

  it("creates a user and reads it back safely (no password)", async () => {
    const created = await users.create({ name: "Ada", email: "ada@x.io", password: "hash" })
    expect(created).toEqual({ id: expect.any(String), name: "Ada", email: "ada@x.io" })
    const safe = await users.findSafeByEmail("ada@x.io")
    expect(safe).toEqual(created)
    expect((safe as Record<string, unknown>).password).toBeUndefined()
  })

  it("increments failed attempts, locks, and resets", async () => {
    const u = await users.create({ name: "B", email: "b@x.io", password: "h" })
    expect(await users.incrementFailedAttempts(u.id)).toBe(1)
    expect(await users.incrementFailedAttempts(u.id)).toBe(2)
    const until = new Date(Date.now() + 60000)
    await users.lockAccount(u.id, until)
    const locked = await users.findWithPasswordByEmail("b@x.io")
    expect(locked?.failedLoginAttempts).toBe(0)
    expect(locked?.lockedUntil?.getTime()).toBe(until.getTime())
    await users.resetLockout(u.id)
    const reset = await users.findWithPasswordByEmail("b@x.io")
    expect(reset?.failedLoginAttempts).toBe(0)
    expect(reset?.lockedUntil).toBeNull()
  })
})
