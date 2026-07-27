import { Test } from "@nestjs/testing"
import { Controller, Get, INestApplication } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import request from "supertest"
import { AppModule } from "../src/app.module"
import { createTestApp } from "./create-test-app"
import { PrismaService } from "@core/database/prisma.service"
import { Public } from "@shared/decorators/public.decorator"
import { truncateAll, seedPermissions } from "./setup-e2e"
import { signupAndSignin, createOrg } from "./factory"

// Test-only route that surfaces a bare Prisma P2025 (record not found) so the
// AllExceptionsFilter's central mapping can be asserted without staging a
// row-vanishes-between-check-and-write race against the real database.
@Controller("__p2025__")
class P2025Controller {
  @Public()
  @Get()
  boom(): never {
    throw new Prisma.PrismaClientKnownRequestError("No record found", {
      code: "P2025",
      clientVersion: "test",
    })
  }
}

describe("Error envelope (e2e)", () => {
  let app: INestApplication
  let prisma: PrismaService
  beforeAll(async () => {
    const ref = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [P2025Controller],
    }).compile()
    app = await createTestApp(ref)
    prisma = app.get(PrismaService)
  })
  beforeEach(async () => {
    await truncateAll(prisma)
    await seedPermissions(prisma)
  })
  afterAll(async () => app.close())
  const agent = () => request(app.getHttpServer())

  function assertErrorShape(body: unknown): void {
    expect(body).toEqual({
      message: expect.any(String),
      data: null,
      request_id: expect.stringMatching(/^[0-9a-f-]{32,36}$/i),
    })
  }

  it("401 (no auth) has a string message and data:null", async () => {
    const res = await agent().get("/api/v1/permissions")
    expect(res.status).toBe(401)
    assertErrorShape(res.body)
  })

  it("400 (validation) flattens class-validator arrays to a single string", async () => {
    const res = await agent()
      .post("/api/v1/auth/signup")
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
    const forbidden = await agent().get(`/api/v1/orgs/${id}`).set("Cookie", outsider.cookies)
    expect(forbidden.status).toBe(403)
    assertErrorShape(forbidden.body)
  })

  it("404 (missing) keeps the shape", async () => {
    const { cookies } = await signupAndSignin(app)
    const notFound = await agent()
      .get("/api/v1/orgs/11111111-1111-1111-1111-111111111111")
      .set("Cookie", cookies)
    expect(notFound.status).toBe(404)
    assertErrorShape(notFound.body)
  })

  it("echoes a client-supplied request id into the error body", async () => {
    const id = "11111111-2222-4333-8444-555555555555"
    // Authenticated so the request reaches OrgGuard's UUID validation (400)
    // instead of stopping at JwtAuthGuard with a 401.
    const { cookies } = await signupAndSignin(app)
    const { body } = await agent()
      .get("/api/v1/orgs/not-a-uuid")
      .set("Cookie", cookies)
      .set("X-Request-Id", id)
      .expect(400)
    expect(body.request_id).toBe(id)
  })

  it("maps Prisma P2025 to 404 instead of 500", async () => {
    const { body } = await agent().get("/api/v1/__p2025__").expect(404)
    expect(body).toEqual({ message: "Not found", data: null, request_id: expect.any(String) })
  })
})
