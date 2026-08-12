import { Test } from "@nestjs/testing"
import { INestApplication } from "@nestjs/common"
import request from "supertest"
import { AppModule } from "../../src/app.module"
import { createTestApp } from "../create-test-app"
import { PrismaService } from "@core/database/prisma.service"
import { truncateAll } from "../setup-e2e"

const CREDS = {
  name: "Lock",
  email: "lock@x.io",
  password: "Str0ng!pass",
  confirmation_password: "Str0ng!pass",
}

describe("Account lockout (e2e)", () => {
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

  it("locks the account after 5 failed attempts, rejecting even the correct password", async () => {
    await agent().post("/api/v1/auth/signup").send(CREDS)
    for (let i = 0; i < 5; i++) {
      const bad = await agent()
        .post("/api/v1/auth/signin")
        .send({ email: CREDS.email, password: "Wr0ng!pass" })
      expect(bad.status).toBe(401)
    }
    const locked = await agent()
      .post("/api/v1/auth/signin")
      .send({ email: CREDS.email, password: CREDS.password })
    expect(locked.status).toBe(401)
    expect(locked.body.message).toBe("invalid credentials")

    const row = await prisma.user.findUnique({
      where: { email: CREDS.email },
      select: { lockedUntil: true },
    })
    expect(row?.lockedUntil).not.toBeNull()
  })
})
