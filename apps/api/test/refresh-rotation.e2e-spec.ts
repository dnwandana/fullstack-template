import { Test } from "@nestjs/testing"
import { INestApplication } from "@nestjs/common"
import { randomUUID } from "crypto"
import request from "supertest"
import { AppModule } from "../src/app.module"
import { createTestApp } from "./create-test-app"
import { PrismaService } from "@core/database/prisma.service"
import { RefreshTokenService } from "@modules/auth/refresh-token.service"
import { signupAndSignin } from "./factory"
import { truncateAll } from "./setup-e2e"

// Rotation must CLAIM the presented token atomically (set revokedAt only if still
// null), not read-check-revoke: with the latter, two concurrent presenters of the
// same token both pass the revokedAt check and both walk away with a live session —
// the reuse alarm this codebase ships never fires for the racing thief.
describe("Refresh rotation claims the token atomically (e2e)", () => {
  let app: INestApplication
  let prisma: PrismaService
  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = await createTestApp(ref)
    prisma = app.get(PrismaService)
  })
  beforeEach(async () => truncateAll(prisma))
  afterAll(async () => app.close())

  const agent = () => request(app.getHttpServer())

  it("lets exactly one claim of the same token win", async () => {
    const refreshTokens = app.get(RefreshTokenService)
    const user = await prisma.user.create({
      data: { id: randomUUID(), name: "Racer", email: "racer@x.io", password: "hash" },
      select: { id: true },
    })
    const row = await prisma.refreshToken.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        tokenHash: "a".repeat(64),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
      select: { id: true },
    })

    expect(await refreshTokens.claimForRotation(row.id)).toBe(true)
    // Second presenter of the same row: the claim must fail, never silently re-revoke.
    expect(await refreshTokens.claimForRotation(row.id)).toBe(false)
  })

  it("gives exactly one of N concurrent refreshes with the same cookie a session", async () => {
    const { cookies } = await signupAndSignin(app)

    const responses = await Promise.all(
      Array.from({ length: 4 }, () => agent().post("/api/v1/auth/refresh").set("Cookie", cookies)),
    )

    const statuses = responses.map((r: { status: number }) => r.status).toSorted()
    expect(statuses).toEqual([200, 401, 401, 401])
  })
})
