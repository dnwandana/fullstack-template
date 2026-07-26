import { Test } from "@nestjs/testing"
import { INestApplication } from "@nestjs/common"
import request from "supertest"
import { AppModule } from "../src/app.module"
import { createTestApp } from "./create-test-app"
import { PrismaService } from "../src/prisma/prisma.service"
import { truncateAll, seedPermissions } from "./setup-e2e"
import { signupAndSignin, createOrg, getRoleId } from "./factory"

describe("Todos (e2e)", () => {
  let app: INestApplication
  let prisma: PrismaService
  let cookies: string[]
  let projectId: string
  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = await createTestApp(ref)
    prisma = app.get(PrismaService)
  })
  afterAll(async () => app.close())
  const agent = () => request(app.getHttpServer())

  beforeEach(async () => {
    await truncateAll(prisma)
    await seedPermissions(prisma)
    const user = await signupAndSignin(app)
    cookies = user.cookies
    const org = await createOrg(app, cookies)
    const proj = await agent()
      .post(`/api/orgs/${org.id}/projects`)
      .set("Cookie", cookies)
      .send({ name: "P" })
    projectId = proj.body.data.id
    ;(globalThis as Record<string, unknown>).__orgId = org.id
  })
  const base = () =>
    `/api/orgs/${(globalThis as Record<string, unknown>).__orgId}/projects/${projectId}/todos`

  it("creates a todo (title required)", async () => {
    const missing = await agent()
      .post(base())
      .set("Cookie", cookies)
      .send({ description: "no title" })
    expect(missing.status).toBe(400)
    const ok = await agent().post(base()).set("Cookie", cookies).send({ title: "Buy milk" })
    expect(ok.status).toBe(201)
    expect(ok.body.data.title).toBe("Buy milk")
  })

  it("denies a viewer creating a todo with 403", async () => {
    const orgId = (globalThis as Record<string, unknown>).__orgId as string
    const viewer = await signupAndSignin(app)
    const viewerRoleId = await getRoleId(prisma, orgId, "viewer")
    await prisma.orgMember.create({
      data: { orgId, userId: viewer.userId, roleId: viewerRoleId },
    })
    await prisma.projectMember.create({
      data: { projectId, userId: viewer.userId, roleId: viewerRoleId },
    })
    const res = await agent().post(base()).set("Cookie", viewer.cookies).send({ title: "Nope" })
    expect(res.status).toBe(403)
  })

  it("lists todos with a pagination envelope", async () => {
    for (let i = 0; i < 3; i++)
      await agent()
        .post(base())
        .set("Cookie", cookies)
        .send({ title: `T${i}` })
    const res = await agent().get(`${base()}?page=1&limit=2`).set("Cookie", cookies)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.pagination).toMatchObject({
      current_page: 1,
      items_per_page: 2,
      total_items: 3,
      total_pages: 2,
      has_next_page: true,
    })
  })

  it("rejects an unknown query key with 400", async () => {
    const res = await agent().get(`${base()}?bogus=1`).set("Cookie", cookies)
    expect(res.status).toBe(400)
  })

  it("returns 404 when updating a todo that does not exist", async () => {
    const res = await agent()
      .put(`${base()}/11111111-1111-1111-1111-111111111111`)
      .set("Cookie", cookies)
      .send({ title: "ghost" })
    expect(res.status).toBe(404)
  })

  it("will not update a todo through a sibling project's URL", async () => {
    const created = await agent().post(base()).set("Cookie", cookies).send({ title: "A" })
    const todoId = created.body.data.id
    const orgId = (globalThis as Record<string, unknown>).__orgId
    const other = await agent()
      .post(`/api/orgs/${orgId}/projects`)
      .set("Cookie", cookies)
      .send({ name: "Other" })
    const otherProjectId = other.body.data.id
    const res = await agent()
      .put(`/api/orgs/${orgId}/projects/${otherProjectId}/todos/${todoId}`)
      .set("Cookie", cookies)
      .send({ title: "hijacked" })
    expect(res.status).toBe(404)
    const still = await prisma.todo.findUnique({ where: { id: todoId } })
    expect(still?.title).toBe("A")
  })

  it("rejects a malformed todo id with 400", async () => {
    const res = await agent()
      .put(`${base()}/not-a-uuid`)
      .set("Cookie", cookies)
      .send({ title: "X" })
    expect(res.status).toBe(400)
  })

  it("reads a single todo with snake_case fields", async () => {
    const created = await agent().post(base()).set("Cookie", cookies).send({ title: "Read me" })
    const res = await agent().get(`${base()}/${created.body.data.id}`).set("Cookie", cookies)
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      id: created.body.data.id,
      title: "Read me",
      is_completed: false,
      project_id: projectId,
    })
    const missing = await agent()
      .get(`${base()}/11111111-1111-1111-1111-111111111111`)
      .set("Cookie", cookies)
    expect(missing.status).toBe(404)
  })

  it("treats ILIKE wildcards in search as literals", async () => {
    await agent().post(base()).set("Cookie", cookies).send({ title: "100% done" })
    await agent().post(base()).set("Cookie", cookies).send({ title: "100x done" })
    const res = await agent()
      .get(`${base()}?search=${encodeURIComponent("100%")}`)
      .set("Cookie", cookies)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].title).toBe("100% done")
  })

  it("bulk-deletes by ids and single-deletes without 404", async () => {
    const a = await agent().post(base()).set("Cookie", cookies).send({ title: "A" })
    const b = await agent().post(base()).set("Cookie", cookies).send({ title: "B" })
    const bulk = await agent()
      .delete(`${base()}?ids=${a.body.data.id},${b.body.data.id}`)
      .set("Cookie", cookies)
    expect(bulk.status).toBe(200)
    const single = await agent()
      .delete(`${base()}/11111111-1111-1111-1111-111111111111`)
      .set("Cookie", cookies)
    expect(single.status).toBe(200)
  })

  it("PUT is full-replace: omitted optional fields reset to defaults", async () => {
    const created = await agent()
      .post(base())
      .set("Cookie", cookies)
      .send({ title: "t", description: "keep?", is_completed: true })
    expect(created.status).toBe(201)
    const updated = await agent()
      .put(`${base()}/${created.body.data.id}`)
      .set("Cookie", cookies)
      .send({ title: "t2" })
    expect(updated.status).toBe(200)
    expect(updated.body.data).toMatchObject({
      title: "t2",
      description: null,
      is_completed: false,
    })
  })

  it("bumps updated_at on edit and reorders the default list", async () => {
    const first = await agent().post(base()).set("Cookie", cookies).send({ title: "Older" })
    await agent().post(base()).set("Cookie", cookies).send({ title: "Newer" })

    const updated = await agent()
      .put(`${base()}/${first.body.data.id}`)
      .set("Cookie", cookies)
      .send({ title: "Older, edited" })
    expect(updated.status).toBe(200)
    expect(new Date(updated.body.data.updated_at).getTime()).toBeGreaterThan(
      new Date(updated.body.data.created_at).getTime(),
    )

    const list = await agent().get(base()).set("Cookie", cookies)
    expect(list.body.data[0].id).toBe(first.body.data.id)
  })
})
