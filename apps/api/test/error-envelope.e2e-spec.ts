import { Test } from "@nestjs/testing"
import { INestApplication } from "@nestjs/common"
import request from "supertest"
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/bootstrap"
import { PrismaService } from "../src/prisma/prisma.service"
import { truncateAll, seedPermissions } from "./setup-e2e"
import { signupAndSignin, createOrg } from "./factory"

describe("Error envelope (e2e)", () => {
  let app: INestApplication
  let prisma: PrismaService
  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = ref.createNestApplication({ bufferLogs: true })
    configureApp(app)
    await app.init()
    prisma = app.get(PrismaService)
  })
  beforeEach(async () => {
    await truncateAll(prisma)
    await seedPermissions(prisma)
  })
  afterAll(async () => app.close())
  const agent = () => request(app.getHttpServer())

  function assertErrorShape(body: unknown): void {
    expect(body).toEqual({ message: expect.any(String), data: null })
  }

  it("401 (no auth) has a string message and data:null", async () => {
    const res = await agent().get("/api/permissions")
    expect(res.status).toBe(401)
    assertErrorShape(res.body)
  })

  it("400 (validation) flattens class-validator arrays to a single string", async () => {
    const res = await agent()
      .post("/api/auth/signup")
      .send({ name: "", email: "nope", password: "weak", confirmation_password: "different" })
    expect(res.status).toBe(400)
    assertErrorShape(res.body)
    // The multiple validation failures above must collapse into ONE string
    // joined with "; " (the AllExceptionsFilter contract), never an array.
    expect(res.body.message).toContain("; ")
  })

  it("403 (permission) keeps the shape", async () => {
    const owner = await signupAndSignin(app)
    const outsider = await signupAndSignin(app)
    const { id } = await createOrg(app, owner.cookies)
    const forbidden = await agent().get(`/api/orgs/${id}`).set("Cookie", outsider.cookies)
    expect(forbidden.status).toBe(403)
    assertErrorShape(forbidden.body)
  })

  it("404 (missing) keeps the shape", async () => {
    const { cookies } = await signupAndSignin(app)
    const notFound = await agent()
      .get("/api/orgs/11111111-1111-1111-1111-111111111111")
      .set("Cookie", cookies)
    expect(notFound.status).toBe(404)
    assertErrorShape(notFound.body)
  })
})
