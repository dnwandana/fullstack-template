import { Test } from "@nestjs/testing"
import { INestApplication } from "@nestjs/common"
import request from "supertest"
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/bootstrap"
import { PrismaService } from "../src/prisma/prisma.service"
import { truncateAll } from "./setup-e2e"

const CREDS = {
  name: "Ada",
  email: "ada@x.io",
  password: "Str0ng!pass",
  confirmation_password: "Str0ng!pass",
}

describe("Auth (e2e)", () => {
  let app: INestApplication
  let prisma: PrismaService
  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = ref.createNestApplication({ bufferLogs: true })
    configureApp(app)
    await app.init()
    prisma = app.get(PrismaService)
  })
  beforeEach(async () => truncateAll(prisma))
  afterAll(async () => app.close())

  const agent = () => request(app.getHttpServer())

  it("signs up (201) then rejects a duplicate email (400)", async () => {
    const res = await agent().post("/api/auth/signup").send(CREDS)
    expect(res.status).toBe(201)
    expect(res.body).toEqual({
      message: "Created",
      data: { id: expect.any(String), name: "Ada", email: "ada@x.io" },
    })
    const dup = await agent().post("/api/auth/signup").send(CREDS)
    expect(dup.status).toBe(400)
    expect(typeof dup.body.message).toBe("string")
  })

  it("signs in, sets both cookies, and reads /me", async () => {
    await agent().post("/api/auth/signup").send(CREDS)
    const res = await agent()
      .post("/api/auth/signin")
      .send({ email: CREDS.email, password: CREDS.password })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      message: "OK",
      data: { id: expect.any(String), name: "Ada", email: "ada@x.io" },
    })
    const cookies = res.headers["set-cookie"] as unknown as string[]
    expect(cookies.some((c) => c.startsWith("access_token="))).toBe(true)
    expect(cookies.some((c) => c.startsWith("refresh_token="))).toBe(true)
    const me = await agent().get("/api/auth/me").set("Cookie", cookies)
    expect(me.status).toBe(200)
    expect(me.body.data.email).toBe("ada@x.io")
  })

  it("rejects bad credentials with 401 invalid credentials", async () => {
    await agent().post("/api/auth/signup").send(CREDS)
    const res = await agent()
      .post("/api/auth/signin")
      .send({ email: CREDS.email, password: "Wr0ng!pass" })
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ message: "invalid credentials", data: null })
  })

  it("rotates the refresh token and revokes the old one", async () => {
    await agent().post("/api/auth/signup").send(CREDS)
    const signin = await agent()
      .post("/api/auth/signin")
      .send({ email: CREDS.email, password: CREDS.password })
    const cookies = signin.headers["set-cookie"] as unknown as string[]
    const refresh = await agent().post("/api/auth/refresh").set("Cookie", cookies)
    expect(refresh.status).toBe(200)
    expect(refresh.body).toEqual({ message: "OK", data: null })
    // Old refresh cookie is now revoked → reusing it fails.
    const reuse = await agent().post("/api/auth/refresh").set("Cookie", cookies)
    expect(reuse.status).toBe(401)
  })

  it("rejects /me without a cookie (401)", async () => {
    const res = await agent().get("/api/auth/me")
    expect(res.status).toBe(401)
  })

  it("logs out idempotently (200) and clears cookies", async () => {
    await agent().post("/api/auth/signup").send(CREDS)
    const signin = await agent()
      .post("/api/auth/signin")
      .send({ email: CREDS.email, password: CREDS.password })
    const cookies = signin.headers["set-cookie"] as unknown as string[]
    const res = await agent().post("/api/auth/logout").set("Cookie", cookies)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ message: "OK", data: null })
  })
})
