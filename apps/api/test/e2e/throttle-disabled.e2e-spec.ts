import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import request from "supertest"
import { PrismaService } from "@core/database/prisma.service"
import { authThrottleLimit } from "@core/config/auth-throttle"
import { createTestApp } from "../create-test-app"
import { truncateAll } from "../setup-e2e"

describe("THROTTLE_DISABLED=true (e2e)", () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    // Before the import: ConfigModule validates process.env when app.module first loads.
    process.env.THROTTLE_DISABLED = "true"
    const { AppModule } = await import("../../src/app.module")
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = await createTestApp(ref)
    prisma = app.get(PrismaService)
  })
  beforeEach(async () => truncateAll(prisma))
  afterAll(async () => {
    await app.close()
    delete process.env.THROTTLE_DISABLED
  })

  const agent = () => request(app.getHttpServer())

  it("sends no 429 and no rate-limit header past RATE_LIMIT_AUTH_MAX", async () => {
    for (let i = 0; i < authThrottleLimit() + 2; i += 1) {
      const res = await agent()
        .post("/api/v1/auth/signin")
        .send({ email: `nobody${i}@example.com`, password: "Wr0ng!pass" })
      expect(res.status).toBe(401)
      expect(res.headers["x-ratelimit-limit-general"]).toBeUndefined()
    }
  })

  it("still locks an account after five failed sign-ins", async () => {
    const creds = { name: "Lock", email: "lock@x.io", password: "Str0ng!pass" }
    await agent()
      .post("/api/v1/auth/signup")
      .send({ ...creds, confirmation_password: creds.password })
    for (let i = 0; i < 5; i += 1) {
      await agent().post("/api/v1/auth/signin").send({ email: creds.email, password: "Wr0ng!pass" })
    }
    const locked = await agent()
      .post("/api/v1/auth/signin")
      .send({ email: creds.email, password: creds.password })
    expect(locked.status).toBe(401)
    const row = await prisma.user.findUnique({
      where: { email: creds.email },
      select: { lockedUntil: true },
    })
    expect(row?.lockedUntil).not.toBeNull()
  })
})
