import { Test } from "@nestjs/testing"
import { INestApplication } from "@nestjs/common"
import request from "supertest"
import { AppModule } from "../../src/app.module"
import { createTestApp } from "../create-test-app"
import { PrismaService } from "@core/database/prisma.service"
import { truncateAll, seedPermissions } from "../setup-e2e"
import { signupAndSignin, createOrg, getRoleId } from "../factory"

describe("Members (e2e)", () => {
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

  it("lists org members and blocks the owner from changing their own role", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const list = await agent().get(`/api/v1/orgs/${org.id}/members`).set("Cookie", owner.cookies)
    expect(list.status).toBe(200)
    expect(list.body.data).toHaveLength(1)

    const adminRoleId = await getRoleId(prisma, org.id, "admin")
    const selfChange = await agent()
      .put(`/api/v1/orgs/${org.id}/members/${owner.userId}`)
      .set("Cookie", owner.cookies)
      .send({ role_id: adminRoleId })
    expect(selfChange.status).toBe(400)
  })

  it("rejects a malformed member user id with 400", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const adminRoleId = await getRoleId(prisma, org.id, "admin")
    const res = await agent()
      .put(`/api/v1/orgs/${org.id}/members/not-a-uuid`)
      .set("Cookie", owner.cookies)
      .send({ role_id: adminRoleId })
    expect(res.status).toBe(400)
  })

  it("lists members with snake_case fields", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const list = await agent().get(`/api/v1/orgs/${org.id}/members`).set("Cookie", owner.cookies)
    expect(list.body.data[0]).toMatchObject({ user_id: owner.userId, role_name: "owner" })
    expect(list.body.data[0].email).toBeDefined()
    expect(list.body.data[0].name).toBeDefined()
  })

  it("keeps at least one owner when two owners demote each other concurrently", async () => {
    const a = await signupAndSignin(app)
    const org = await createOrg(app, a.cookies)
    const b = await signupAndSignin(app)
    const ownerRoleId = await getRoleId(prisma, org.id, "owner")
    const adminRoleId = await getRoleId(prisma, org.id, "admin")
    await prisma.orgMember.create({
      data: { orgId: org.id, userId: b.userId, roleId: ownerRoleId },
    })

    const [r1, r2] = await Promise.all([
      agent()
        .put(`/api/v1/orgs/${org.id}/members/${b.userId}`)
        .set("Cookie", a.cookies)
        .send({ role_id: adminRoleId }),
      agent()
        .put(`/api/v1/orgs/${org.id}/members/${a.userId}`)
        .set("Cookie", b.cookies)
        .send({ role_id: adminRoleId }),
    ])
    expect([r1.status, r2.status].toSorted()).toEqual([200, 403])
    const owners = await prisma.orgMember.count({
      where: { orgId: org.id, role: { name: "owner" } },
    })
    expect(owners).toBe(1)
  })

  it("returns the updated membership in the response body", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const member = await signupAndSignin(app)
    const memberRoleId = await getRoleId(prisma, org.id, "member")
    const adminRoleId = await getRoleId(prisma, org.id, "admin")
    await prisma.orgMember.create({
      data: { orgId: org.id, userId: member.userId, roleId: memberRoleId },
    })

    const { body } = await agent()
      .put(`/api/v1/orgs/${org.id}/members/${member.userId}`)
      .set("Cookie", owner.cookies)
      .send({ role_id: adminRoleId })
      .expect(200)
    expect(body.data).toEqual({
      user_id: member.userId,
      org_id: org.id,
      role_id: adminRoleId,
      joined_at: expect.any(String),
      name: expect.any(String),
      email: expect.any(String),
      role_name: "admin",
    })
  })

  it("returns the updated project membership in the response body", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const proj = await agent()
      .post(`/api/v1/orgs/${org.id}/projects`)
      .set("Cookie", owner.cookies)
      .send({ name: "P" })
    const projectId = proj.body.data.id as string

    const member = await signupAndSignin(app)
    const memberRoleId = await getRoleId(prisma, org.id, "member")
    const viewerRoleId = await getRoleId(prisma, org.id, "viewer")
    await prisma.orgMember.create({
      data: { orgId: org.id, userId: member.userId, roleId: memberRoleId },
    })
    await prisma.projectMember.create({
      data: { projectId, userId: member.userId, roleId: memberRoleId },
    })

    const { body } = await agent()
      .put(`/api/v1/orgs/${org.id}/projects/${projectId}/members/${member.userId}`)
      .set("Cookie", owner.cookies)
      .send({ role_id: viewerRoleId })
      .expect(200)
    expect(body.data).toEqual({
      user_id: member.userId,
      project_id: projectId,
      role_id: viewerRoleId,
      joined_at: expect.any(String),
      name: expect.any(String),
      email: expect.any(String),
      role_name: "viewer",
    })
  })

  it("paginates the org members list", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const member = await signupAndSignin(app)
    const memberRoleId = await getRoleId(prisma, org.id, "member")
    await prisma.orgMember.create({
      data: { orgId: org.id, userId: member.userId, roleId: memberRoleId },
    })

    const { body } = await agent()
      .get(`/api/v1/orgs/${org.id}/members?page=1&limit=1`)
      .set("Cookie", owner.cookies)
      .expect(200)
    expect(body.data).toHaveLength(1)
    expect(body.pagination).toMatchObject({
      current_page: 1,
      items_per_page: 1,
      total_items: expect.any(Number),
      total_pages: expect.any(Number),
    })
    expect(body.pagination.total_items).toBe(2)
    expect(body.pagination.total_pages).toBe(2)
  })

  it("defaults to limit 50 when no query is sent", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const { body } = await agent()
      .get(`/api/v1/orgs/${org.id}/members`)
      .set("Cookie", owner.cookies)
      .expect(200)
    expect(body.pagination.items_per_page).toBe(50)
  })

  it("rejects a members list limit above 100", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    await agent()
      .get(`/api/v1/orgs/${org.id}/members?limit=200`)
      .set("Cookie", owner.cookies)
      .expect(400)
  })

  it("paginates the project members list", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const proj = await agent()
      .post(`/api/v1/orgs/${org.id}/projects`)
      .set("Cookie", owner.cookies)
      .send({ name: "P" })
    const projectId = proj.body.data.id as string

    const { body } = await agent()
      .get(`/api/v1/orgs/${org.id}/projects/${projectId}/members?page=1&limit=1`)
      .set("Cookie", owner.cookies)
      .expect(200)
    expect(body.data).toHaveLength(1)
    expect(body.pagination).toMatchObject({
      current_page: 1,
      items_per_page: 1,
      total_items: 1,
      total_pages: 1,
    })
  })

  it("blocks removing the last owner", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const res = await agent()
      .delete(`/api/v1/orgs/${org.id}/members/${owner.userId}`)
      .set("Cookie", owner.cookies)
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/last owner/)
  })
})
