import { Test, TestingModule } from "@nestjs/testing"
import { createHash, randomUUID } from "crypto"
import { AppModule } from "@app/app.module"
import { PrismaService } from "@core/database/prisma.service"
import { PasswordResetService } from "@modules/auth/password-reset.service"
import { PasswordService } from "@modules/auth/password.service"
import { truncateAll } from "@test/setup-e2e"

const EMAIL = "reset@x.io"

describe("PasswordResetService", () => {
  let ref: TestingModule
  let service: PasswordResetService
  let passwords: PasswordService
  let prisma: PrismaService
  let userId: string

  beforeAll(async () => {
    ref = await Test.createTestingModule({ imports: [AppModule] }).compile()
    // init() runs onModuleInit — PrismaService connects and PasswordService builds its
    // dummy hash. compile() alone does not.
    await ref.init()
    service = ref.get(PasswordResetService)
    passwords = ref.get(PasswordService)
    prisma = ref.get(PrismaService)
  })

  beforeEach(async () => {
    await truncateAll(prisma)
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        name: "Reset",
        email: EMAIL,
        password: await passwords.hash("Str0ng!pass"),
      },
      select: { id: true },
    })
    userId = user.id
  })

  afterAll(async () => ref.close())

  const plantToken = (raw: string, expiresAt: Date) =>
    prisma.passwordResetToken.create({
      data: {
        id: randomUUID(),
        userId,
        tokenHash: createHash("sha256").update(raw).digest("hex"),
        expiresAt,
      },
    })

  const plantRefreshToken = () =>
    prisma.refreshToken.create({
      data: {
        id: randomUUID(),
        userId,
        tokenHash: createHash("sha256").update(randomUUID()).digest("hex"),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    })

  it("issues a hashed, 1-hour token", async () => {
    await service.issue(EMAIL)
    const row = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId } })
    expect(row.tokenHash).toHaveLength(64)
    expect(row.usedAt).toBeNull()
    const ttl = row.expiresAt.getTime() - Date.now()
    expect(ttl).toBeGreaterThan(55 * 60 * 1000)
    expect(ttl).toBeLessThanOrEqual(60 * 60 * 1000)
  })

  it("is silent for an unknown email", async () => {
    await expect(service.issue("nobody@example.com")).resolves.toBeUndefined()
    expect(await prisma.passwordResetToken.count()).toBe(0)
  })

  it("consumes once, changes the password, and revokes refresh tokens", async () => {
    const raw = "a".repeat(64)
    await plantToken(raw, new Date(Date.now() + 3_600_000))
    await plantRefreshToken()

    await service.consume(raw, "NewPassw0rd!")

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    expect(await passwords.verify(user.password, "NewPassw0rd!")).toBe(true)
    expect(user.failedLoginAttempts).toBe(0)
    expect(user.lockedUntil).toBeNull()
    expect(await prisma.refreshToken.count({ where: { userId, revokedAt: null } })).toBe(0)

    await expect(service.consume(raw, "Another0ne!")).rejects.toMatchObject({ status: 400 })
  })

  it("rejects an expired token", async () => {
    const raw = "b".repeat(64)
    await plantToken(raw, new Date(Date.now() - 1000))
    await expect(service.consume(raw, "NewPassw0rd!")).rejects.toMatchObject({ status: 400 })
  })

  // A completed reset is a full credential rotation: a token requested earlier (say,
  // by an attacker with transient mailbox access) must not survive the victim's reset.
  it("consuming a token voids the user's other outstanding tokens", async () => {
    const consumed = "c".repeat(64)
    const sibling = "d".repeat(64)
    await plantToken(consumed, new Date(Date.now() + 3_600_000))
    await plantToken(sibling, new Date(Date.now() + 3_600_000))

    await service.consume(consumed, "NewPassw0rd!")

    await expect(service.consume(sibling, "Another0ne!")).rejects.toMatchObject({ status: 400 })
  })

  it("issuing a new token voids earlier outstanding ones", async () => {
    await service.issue(EMAIL)
    await service.issue(EMAIL)

    // The newest link is the only valid link.
    expect(await prisma.passwordResetToken.count({ where: { userId, usedAt: null } })).toBe(1)
  })
})
