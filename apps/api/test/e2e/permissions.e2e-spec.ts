import { Test } from "@nestjs/testing"
import { INestApplication } from "@nestjs/common"
import request from "supertest"
import { AppModule } from "../../src/app.module"
import { createTestApp } from "../create-test-app"
import { PrismaService } from "@core/database/prisma.service"
import { truncateAll, seedPermissions } from "../setup-e2e"
import { signupAndSignin } from "../factory"

describe("Permissions (e2e)", () => {
  let app: INestApplication
  let prisma: PrismaService
  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = await createTestApp(ref)
    prisma = app.get(PrismaService)
  })
  beforeEach(async () => {
    await truncateAll(prisma)
    await seedPermissions(prisma)
  })
  afterAll(async () => app.close())

  it("requires auth (401 without cookie)", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/permissions")
    expect(res.status).toBe(401)
  })

  it("returns the full permission list for an authed user", async () => {
    const { cookies } = await signupAndSignin(app)
    const res = await request(app.getHttpServer()).get("/api/v1/permissions").set("Cookie", cookies)
    expect(res.status).toBe(200)
    expect(res.body.message).toBe("OK")
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThanOrEqual(16)
    expect(res.body.pagination).toBeUndefined()
  })
})
