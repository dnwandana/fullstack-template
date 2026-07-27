import { Test } from "@nestjs/testing"
import { INestApplication } from "@nestjs/common"
import request from "supertest"
import { AppModule } from "../src/app.module"
import { createTestApp } from "./create-test-app"
import { PrismaService } from "@core/database/prisma.service"
import { truncateAll, seedPermissions } from "./setup-e2e"
import { signupAndSignin } from "./factory"

describe("Orgs (e2e)", () => {
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
  const agent = () => request(app.getHttpServer())

  it("creates an org with 4 system roles and an owner membership", async () => {
    const { cookies, userId } = await signupAndSignin(app)
    const res = await agent().post("/api/v1/orgs").set("Cookie", cookies).send({ name: "Acme" })
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({ id: expect.any(String), name: "Acme" })
    const roles = await prisma.role.findMany({ where: { orgId: res.body.data.id } })
    expect(roles.map((r) => r.name).toSorted()).toEqual(["admin", "member", "owner", "viewer"])
    const membership = await prisma.orgMember.findFirst({
      where: { orgId: res.body.data.id, userId },
    })
    expect(membership).not.toBeNull()
  })

  it("lists only the caller's orgs", async () => {
    const a = await signupAndSignin(app)
    const b = await signupAndSignin(app)
    await agent().post("/api/v1/orgs").set("Cookie", a.cookies).send({ name: "A-org" })
    const list = await agent().get("/api/v1/orgs").set("Cookie", b.cookies)
    expect(list.status).toBe(200)
    expect(list.body.data).toHaveLength(0)
  })

  it("reads, updates, and deletes an org by permission", async () => {
    const { cookies } = await signupAndSignin(app)
    const created = await agent().post("/api/v1/orgs").set("Cookie", cookies).send({ name: "Acme" })
    const id = created.body.data.id
    expect((await agent().get(`/api/v1/orgs/${id}`).set("Cookie", cookies)).status).toBe(200)
    const upd = await agent()
      .put(`/api/v1/orgs/${id}`)
      .set("Cookie", cookies)
      .send({ name: "Acme 2" })
    expect(upd.body.data.name).toBe("Acme 2")
    expect((await agent().delete(`/api/v1/orgs/${id}`).set("Cookie", cookies)).status).toBe(200)
  })

  it("returns snake_case fields on org reads", async () => {
    const { cookies } = await signupAndSignin(app)
    const created = await agent().post("/api/v1/orgs").set("Cookie", cookies).send({ name: "Acme" })
    const res = await agent().get(`/api/v1/orgs/${created.body.data.id}`).set("Cookie", cookies)
    expect(res.body.data.created_at).toBeDefined()
    expect(res.body.data.updated_at).toBeDefined()
    expect(res.body.data.createdAt).toBeUndefined()
  })

  it("rejects a malformed org id with 400", async () => {
    const { cookies } = await signupAndSignin(app)
    const res = await agent().get("/api/v1/orgs/not-a-uuid").set("Cookie", cookies)
    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Invalid organization ID format")
  })

  it("returns 404 for a missing org and 403 for a non-member", async () => {
    const owner = await signupAndSignin(app)
    const outsider = await signupAndSignin(app)
    const created = await agent()
      .post("/api/v1/orgs")
      .set("Cookie", owner.cookies)
      .send({ name: "Acme" })
    const id = created.body.data.id
    const notMember = await agent().get(`/api/v1/orgs/${id}`).set("Cookie", outsider.cookies)
    expect(notMember.status).toBe(403)
    expect(notMember.body.message).toBe("You are not a member of this organization")
    const missing = await agent()
      .get("/api/v1/orgs/11111111-1111-1111-1111-111111111111")
      .set("Cookie", owner.cookies)
    expect(missing.status).toBe(404)
    expect(missing.body.message).toBe("Organization not found")
  })
})
