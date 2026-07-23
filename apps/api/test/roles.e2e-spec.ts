import { Test } from "@nestjs/testing"
import { INestApplication } from "@nestjs/common"
import request from "supertest"
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/bootstrap"
import { PrismaService } from "../src/prisma/prisma.service"
import { truncateAll, seedPermissions } from "./setup-e2e"
import { signupAndSignin, createOrg } from "./factory"
import { randomUUID } from "crypto"

describe("Roles (e2e)", () => {
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

  it("creates a custom role, lists it, and blocks editing a system role", async () => {
    const { cookies } = await signupAndSignin(app)
    const org = await createOrg(app, cookies)
    const perm = await prisma.permission.findFirstOrThrow({ where: { name: "todos:read" } })

    const created = await agent()
      .post(`/api/orgs/${org.id}/roles`)
      .set("Cookie", cookies)
      .send({ name: "Auditor", description: "read only", permission_ids: [perm.id] })
    expect(created.status).toBe(201)

    const list = await agent().get(`/api/orgs/${org.id}/roles`).set("Cookie", cookies)
    expect(list.status).toBe(200)
    expect(list.body.data.some((r: { name: string }) => r.name === "Auditor")).toBe(true)

    const ownerRole = await prisma.role.findFirstOrThrow({
      where: { orgId: org.id, name: "owner" },
    })
    const blocked = await agent()
      .put(`/api/orgs/${org.id}/roles/${ownerRole.id}`)
      .set("Cookie", cookies)
      .send({ name: "Overlord" })
    expect(blocked.status).toBe(400)
  })

  it("returns 400 when creating a role whose name already exists", async () => {
    const { cookies } = await signupAndSignin(app)
    const org = await createOrg(app, cookies)
    const perm = await prisma.permission.findFirstOrThrow({ where: { name: "todos:read" } })
    const res = await agent()
      .post(`/api/orgs/${org.id}/roles`)
      .set("Cookie", cookies)
      .send({ name: "admin", permission_ids: [perm.id] })
    expect(res.status).toBe(400)
  })

  it("returns 400 when creating a role with unknown permission ids", async () => {
    const { cookies } = await signupAndSignin(app)
    const org = await createOrg(app, cookies)
    const res = await agent()
      .post(`/api/orgs/${org.id}/roles`)
      .set("Cookie", cookies)
      .send({ name: "Ghost", permission_ids: [randomUUID()] })
    expect(res.status).toBe(400)
  })

  it("rejects a malformed role id with 400", async () => {
    const { cookies } = await signupAndSignin(app)
    const org = await createOrg(app, cookies)
    const res = await agent()
      .put(`/api/orgs/${org.id}/roles/not-a-uuid`)
      .set("Cookie", cookies)
      .send({ name: "X" })
    expect(res.status).toBe(400)
  })

  it("reads a single role with its permissions", async () => {
    const { cookies } = await signupAndSignin(app)
    const org = await createOrg(app, cookies)
    const perm = await prisma.permission.findFirstOrThrow({ where: { name: "todos:read" } })
    const created = await agent()
      .post(`/api/orgs/${org.id}/roles`)
      .set("Cookie", cookies)
      .send({ name: "Auditor", permission_ids: [perm.id] })

    const res = await agent()
      .get(`/api/orgs/${org.id}/roles/${created.body.data.id}`)
      .set("Cookie", cookies)
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ name: "Auditor", is_system: false })
    expect(res.body.data.permissions.some((p: { name: string }) => p.name === "todos:read")).toBe(
      true,
    )

    const missing = await agent()
      .get(`/api/orgs/${org.id}/roles/11111111-1111-1111-1111-111111111111`)
      .set("Cookie", cookies)
    expect(missing.status).toBe(404)
  })

  it("blocks deleting a role that is in use", async () => {
    const { cookies } = await signupAndSignin(app)
    const org = await createOrg(app, cookies)
    const perm = await prisma.permission.findFirstOrThrow({ where: { name: "todos:read" } })
    const created = await agent()
      .post(`/api/orgs/${org.id}/roles`)
      .set("Cookie", cookies)
      .send({ name: "Temp", permission_ids: [perm.id] })
    const other = await signupAndSignin(app)
    await prisma.orgMember.create({
      data: { orgId: org.id, userId: other.userId, roleId: created.body.data.id },
    })
    const res = await agent()
      .delete(`/api/orgs/${org.id}/roles/${created.body.data.id}`)
      .set("Cookie", cookies)
    expect(res.status).toBe(400)
  })

  it("deletes an unused custom role but blocks deleting a system role", async () => {
    const { cookies } = await signupAndSignin(app)
    const org = await createOrg(app, cookies)
    const perm = await prisma.permission.findFirstOrThrow({ where: { name: "todos:read" } })
    const created = await agent()
      .post(`/api/orgs/${org.id}/roles`)
      .set("Cookie", cookies)
      .send({ name: "Temp", permission_ids: [perm.id] })
    expect(
      (
        await agent()
          .delete(`/api/orgs/${org.id}/roles/${created.body.data.id}`)
          .set("Cookie", cookies)
      ).status,
    ).toBe(200)

    const memberRole = await prisma.role.findFirstOrThrow({
      where: { orgId: org.id, name: "member" },
    })
    expect(
      (await agent().delete(`/api/orgs/${org.id}/roles/${memberRole.id}`).set("Cookie", cookies))
        .status,
    ).toBe(400)
  })
})
