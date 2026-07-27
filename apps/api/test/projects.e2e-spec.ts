import { Test } from "@nestjs/testing"
import { INestApplication } from "@nestjs/common"
import { randomUUID } from "crypto"
import request from "supertest"
import { AppModule } from "../src/app.module"
import { createTestApp } from "./create-test-app"
import { PrismaService } from "@core/database/prisma.service"
import { truncateAll, seedPermissions } from "./setup-e2e"
import { signupAndSignin, createOrg, getRoleId } from "./factory"

describe("Projects (e2e)", () => {
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

  it("creates, lists, reads, updates, and deletes a project", async () => {
    const { cookies } = await signupAndSignin(app)
    const org = await createOrg(app, cookies)
    const created = await agent()
      .post(`/api/v1/orgs/${org.id}/projects`)
      .set("Cookie", cookies)
      .send({ name: "Website" })
    expect(created.status).toBe(201)
    const id = created.body.data.id

    const list = await agent().get(`/api/v1/orgs/${org.id}/projects`).set("Cookie", cookies)
    expect(list.status).toBe(200)
    expect(list.body.data.some((p: { id: string }) => p.id === id)).toBe(true)

    expect(
      (await agent().get(`/api/v1/orgs/${org.id}/projects/${id}`).set("Cookie", cookies)).status,
    ).toBe(200)
    const upd = await agent()
      .put(`/api/v1/orgs/${org.id}/projects/${id}`)
      .set("Cookie", cookies)
      .send({ name: "Website v2" })
    expect(upd.body.data.name).toBe("Website v2")
    expect(
      (await agent().delete(`/api/v1/orgs/${org.id}/projects/${id}`).set("Cookie", cookies)).status,
    ).toBe(200)
  })

  it("returns snake_case fields on project reads", async () => {
    const { cookies } = await signupAndSignin(app)
    const org = await createOrg(app, cookies)
    const created = await agent()
      .post(`/api/v1/orgs/${org.id}/projects`)
      .set("Cookie", cookies)
      .send({ name: "Website" })
    const res = await agent()
      .get(`/api/v1/orgs/${org.id}/projects/${created.body.data.id}`)
      .set("Cookie", cookies)
    expect(res.body.data).toMatchObject({ org_id: org.id, name: "Website" })
    expect(res.body.data.created_at).toBeDefined()
    expect(res.body.data.orgId).toBeUndefined()
  })

  it("rejects a malformed project id with 400", async () => {
    const { cookies } = await signupAndSignin(app)
    const org = await createOrg(app, cookies)
    const res = await agent()
      .get(`/api/v1/orgs/${org.id}/projects/not-a-uuid`)
      .set("Cookie", cookies)
    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Invalid project ID format")
  })

  it("returns 404 for a missing project", async () => {
    const { cookies } = await signupAndSignin(app)
    const org = await createOrg(app, cookies)
    const res = await agent()
      .get(`/api/v1/orgs/${org.id}/projects/11111111-1111-1111-1111-111111111111`)
      .set("Cookie", cookies)
    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Project not found")
  })

  it("grants org-wide visibility via project:read_all, not via role name", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    await agent()
      .post(`/api/v1/orgs/${org.id}/projects`)
      .set("Cookie", owner.cookies)
      .send({ name: "Owner-only project" })

    // A CUSTOM (non-system) role is the case a role-name check gets wrong.
    const auditor = await signupAndSignin(app)
    const perms = await prisma.permission.findMany({
      where: { name: { in: ["org:read", "project:read", "project:read_all"] } },
      select: { id: true },
    })
    expect(perms).toHaveLength(3)
    const role = await prisma.role.create({
      data: {
        id: randomUUID(),
        orgId: org.id,
        name: "auditor",
        isSystem: false,
        rolePermissions: { create: perms.map((p) => ({ permissionId: p.id })) },
      },
    })
    await prisma.orgMember.create({
      data: { orgId: org.id, userId: auditor.userId, roleId: role.id },
    })

    const res = await agent().get(`/api/v1/orgs/${org.id}/projects`).set("Cookie", auditor.cookies)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })

  it("hides projects a plain member does not belong to", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    await agent()
      .post(`/api/v1/orgs/${org.id}/projects`)
      .set("Cookie", owner.cookies)
      .send({ name: "Owner-only project" })

    // `member` holds project:read (so the guard passes) but not project:read_all.
    const member = await signupAndSignin(app)
    await prisma.orgMember.create({
      data: {
        orgId: org.id,
        userId: member.userId,
        roleId: await getRoleId(prisma, org.id, "member"),
      },
    })

    const res = await agent().get(`/api/v1/orgs/${org.id}/projects`).set("Cookie", member.cookies)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
  })
})
