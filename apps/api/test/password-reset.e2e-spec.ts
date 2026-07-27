import { Test } from "@nestjs/testing"
import { INestApplication } from "@nestjs/common"
import { createHash } from "crypto"
import request from "supertest"
import { AppModule } from "../src/app.module"
import { createTestApp } from "./create-test-app"
import { PrismaService } from "@core/database/prisma.service"
import { signupAndSignin } from "./factory"
import { truncateAll } from "./setup-e2e"

const GENERIC_REPLY = "If an account exists for that address, a reset link has been sent"

describe("Password reset (e2e)", () => {
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

  it("replies identically for known and unknown addresses", async () => {
    const user = await signupAndSignin(app)
    const known = await agent().post("/api/v1/auth/forgot-password").send({ email: user.email })
    const unknown = await agent()
      .post("/api/v1/auth/forgot-password")
      .send({ email: "nobody@example.com" })

    expect(known.status).toBe(200)
    expect(unknown.status).toBe(200)
    expect(known.body).toEqual(unknown.body)
    expect(known.body.message).toBe(GENERIC_REPLY)
  })

  it("resets the password and invalidates the old one", async () => {
    const user = await signupAndSignin(app)
    await agent().post("/api/v1/auth/forgot-password").send({ email: user.email })

    // Overwrite the stored hash with one derived from a token the test knows — the raw
    // token itself is only ever handed to the notifier.
    const raw = "c".repeat(64)
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.userId },
      data: { tokenHash: createHash("sha256").update(raw).digest("hex") },
    })

    const res = await agent()
      .post("/api/v1/auth/reset-password")
      .send({ token: raw, password: "BrandNewP4ss!", confirmation_password: "BrandNewP4ss!" })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ message: "OK", data: null })

    const signin = (password: string) =>
      agent().post("/api/v1/auth/signin").send({ email: user.email, password })
    expect((await signin("Str0ng!pass")).status).toBe(401)
    expect((await signin("BrandNewP4ss!")).status).toBe(200)
  })

  it("rejects a mismatched confirmation_password with 400", async () => {
    const res = await agent()
      .post("/api/v1/auth/reset-password")
      .send({ token: "d".repeat(64), password: "BrandNewP4ss!", confirmation_password: "nope" })
    expect(res.status).toBe(400)
    expect(res.body.data).toBeNull()
  })

  it("rejects an unknown token with 400 and the generic message", async () => {
    const res = await agent()
      .post("/api/v1/auth/reset-password")
      .send({
        token: "e".repeat(64),
        password: "BrandNewP4ss!",
        confirmation_password: "BrandNewP4ss!",
      })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({
      message: "Invalid or expired reset token",
      data: null,
      request_id: expect.any(String),
    })
  })
})
