import { Test, TestingModule } from "@nestjs/testing"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { randomUUID } from "crypto"
import { PrismaModule } from "../src/prisma/prisma.module"
import { PrismaService } from "../src/prisma/prisma.service"
import { CleanupService } from "../src/maintenance/cleanup.service"
import { validate } from "../src/config/env.validation"
import { truncateAll } from "./setup-e2e"

const DAY = 86_400_000

// ScheduleModule is deliberately NOT imported: run() is public and cron-free, so the
// suite never mounts a timer and never manipulates time.
describe("CleanupService", () => {
  let ref: TestingModule
  let service: CleanupService
  let config: ConfigService
  let prisma: PrismaService
  let userId: string

  beforeAll(async () => {
    ref = await Test.createTestingModule({
      imports: [
        PrismaModule,
        // ignoreEnvFile: load-test-env.ts has already loaded .env.test into process.env;
        // reading the developer's local .env on top of that would make this spec depend
        // on an untracked file (and its foreign dev DATABASE_URL).
        ConfigModule.forRoot({ isGlobal: true, validate, ignoreEnvFile: true }),
      ],
      providers: [CleanupService],
    }).compile()
    service = ref.get(CleanupService)
    config = ref.get(ConfigService)
    prisma = ref.get(PrismaService)
    // compile() does not run onModuleInit, so PrismaService has not connected yet.
    await prisma.$connect()
  })

  afterAll(async () => prisma.$disconnect())

  const plantRefreshToken = (hashChar: string, expiresAt: Date, revokedAt?: Date) =>
    prisma.refreshToken.create({
      data: { userId, tokenHash: hashChar.repeat(64), expiresAt, revokedAt },
    })

  const plantResetToken = (hashChar: string, expiresAt: Date) =>
    prisma.passwordResetToken.create({
      data: { id: randomUUID(), userId, tokenHash: hashChar.repeat(64), expiresAt },
    })

  beforeEach(async () => {
    await truncateAll(prisma)
    const user = await prisma.user.create({
      data: { id: randomUUID(), name: "Sweep", email: "sweep@x.io", password: "hash" },
      select: { id: true },
    })
    userId = user.id

    const now = Date.now()
    // "a" is past the 7-day grace window; "b" expired but still inside it; "c" is live.
    await plantRefreshToken("a", new Date(now - 10 * DAY))
    await plantRefreshToken("b", new Date(now - 1 * DAY))
    await plantRefreshToken("c", new Date(now + 1 * DAY))
  })

  const remainingRefreshHashes = async (): Promise<string[]> => {
    const rows = await prisma.refreshToken.findMany({ select: { tokenHash: true } })
    return rows.map((r) => r.tokenHash).toSorted()
  }

  it("deletes rows past their retention window and keeps the rest", async () => {
    const result = await service.run()

    expect(result.refreshTokens).toBe(1)
    expect(await remainingRefreshHashes()).toEqual(["b".repeat(64), "c".repeat(64)])
  })

  it("sweeps the whole backlog even when it spans multiple batches", async () => {
    // Two more past-grace rows on top of the fixture's one: with batchSize 1 the sweep
    // needs four batch transactions (three deletes plus the terminating short batch).
    await plantRefreshToken("f", new Date(Date.now() - 20 * DAY))
    await plantRefreshToken("9", new Date(Date.now() - 30 * DAY))

    const result = await service.run(1)

    expect(result.refreshTokens).toBe(3)
    expect(await remainingRefreshHashes()).toEqual(["b".repeat(64), "c".repeat(64)])
  })

  it("is idempotent", async () => {
    await service.run()
    expect(await service.run()).toEqual({ refreshTokens: 0, resetTokens: 0, invitations: 0 })
  })

  it("deletes a revoked-but-unexpired token once its grace window has passed", async () => {
    // Still valid by expiresAt, but revoked 10 days ago: garbage via the OR branch.
    await plantRefreshToken("d", new Date(Date.now() + 30 * DAY), new Date(Date.now() - 10 * DAY))

    const result = await service.run()

    expect(result.refreshTokens).toBe(2)
    expect(await remainingRefreshHashes()).toEqual(["b".repeat(64), "c".repeat(64)])
  })

  it("keeps a recently revoked token", async () => {
    await plantRefreshToken("e", new Date(Date.now() + 30 * DAY), new Date(Date.now() - 1 * DAY))

    const result = await service.run()

    expect(result.refreshTokens).toBe(1)
    expect(await remainingRefreshHashes()).toEqual(["b".repeat(64), "c".repeat(64), "e".repeat(64)])
  })

  it("prunes reset tokens 7 days after expiry, not before", async () => {
    await plantResetToken("1", new Date(Date.now() - 10 * DAY))
    await plantResetToken("2", new Date(Date.now() - 1 * DAY))

    const result = await service.run()

    expect(result.resetTokens).toBe(1)
    const rows = await prisma.passwordResetToken.findMany({ select: { tokenHash: true } })
    expect(rows.map((r) => r.tokenHash)).toEqual(["2".repeat(64)])
  })

  it("prunes invitations 30 days after expiry, not before", async () => {
    const org = await prisma.organization.create({
      data: { id: randomUUID(), name: "Acme", createdBy: userId },
      select: { id: true },
    })
    const role = await prisma.role.create({
      data: { id: randomUUID(), orgId: org.id, name: "viewer" },
      select: { id: true },
    })
    const plantInvitation = (email: string, expiresAt: Date) =>
      prisma.invitation.create({
        data: {
          id: randomUUID(),
          orgId: org.id,
          inviterId: userId,
          inviteeEmail: email,
          roleId: role.id,
          expiresAt,
        },
      })
    // 31 days past expiry is outside the window; 29 days is still inside it. A 7-day
    // window would wrongly delete both.
    await plantInvitation("stale@x.io", new Date(Date.now() - 31 * DAY))
    await plantInvitation("recent@x.io", new Date(Date.now() - 29 * DAY))

    const result = await service.run()

    expect(result.invitations).toBe(1)
    const rows = await prisma.invitation.findMany({ select: { inviteeEmail: true } })
    expect(rows.map((r) => r.inviteeEmail)).toEqual(["recent@x.io"])
  })

  it("exposes the CLEANUP_ENABLED default through ConfigService", () => {
    // .env.test does not set CLEANUP_ENABLED, so this value comes from Joi's default.
    // (Asserting process.env is undefined would be wrong: @nestjs/config back-assigns
    // validated keys into process.env after validation.)
    expect(config.get<string>("CLEANUP_ENABLED")).toBe("true")
  })

  it("short-circuits handleCron when CLEANUP_ENABLED is false", async () => {
    const disabled = new CleanupService(prisma, {
      get: () => "false",
    } as unknown as ConfigService)

    await disabled.handleCron()

    expect(await prisma.refreshToken.count()).toBe(3)
  })
})
