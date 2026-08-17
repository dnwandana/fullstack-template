import { Test } from "@nestjs/testing"
import { INestApplication } from "@nestjs/common"
import request from "supertest"
import { AppModule } from "../../src/app.module"
import { createTestApp } from "../create-test-app"
import { PrismaService } from "@core/database/prisma.service"
import { truncateAll, seedPermissions } from "../setup-e2e"
import { signupAndSignin, createOrg, getRoleId } from "../factory"

describe("Audit logs (e2e)", () => {
  let app: INestApplication
  let prisma: PrismaService
  let owner: { userId: string; cookies: string[] }
  let orgId: string
  let projectId: string

  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = await createTestApp(ref)
    prisma = app.get(PrismaService)
  })
  afterAll(async () => app.close())
  const agent = () => request(app.getHttpServer())

  const listAuditLogs = (cookies: string[], org: string, query = "") =>
    agent().get(`/api/v1/orgs/${org}/audit-logs${query}`).set("Cookie", cookies)

  const todosBase = () => `/api/v1/orgs/${orgId}/projects/${projectId}/todos`

  const createTodo = (title: string) =>
    agent().post(todosBase()).set("Cookie", owner.cookies).send({ title })

  // Each test starts from one owner, one org and one project. Those two creations
  // already write the first two audit entries: org.created and project.created.
  beforeEach(async () => {
    await truncateAll(prisma)
    await seedPermissions(prisma)
    owner = await signupAndSignin(app, { name: "Owner One" })
    const org = await createOrg(app, owner.cookies, "Acme")
    orgId = org.id
    const proj = await agent()
      .post(`/api/v1/orgs/${orgId}/projects`)
      .set("Cookie", owner.cookies)
      .send({ name: "Apollo" })
    projectId = proj.body.data.id
  })

  it("records entries for real mutations", async () => {
    const created = await createTodo("Buy milk")
    expect(created.status).toBe(201)
    const updated = await agent()
      .put(`${todosBase()}/${created.body.data.id}`)
      .set("Cookie", owner.cookies)
      .send({ title: "Buy milk", is_completed: true })
    expect(updated.status).toBe(200)

    const res = await listAuditLogs(owner.cookies, orgId)
    expect(res.status).toBe(200)
    const actions = res.body.data.map((row: { action: string }) => row.action)
    expect(actions).toEqual(
      expect.arrayContaining(["org.created", "project.created", "todo.created", "todo.updated"]),
    )
  })

  it("stores a snake_case diff on todo.updated", async () => {
    // PUT is full-replace: the same title plus is_completed true changes one field only.
    const created = await createTodo("Task")
    await agent()
      .put(`${todosBase()}/${created.body.data.id}`)
      .set("Cookie", owner.cookies)
      .send({ title: "Task", is_completed: true })

    const res = await listAuditLogs(owner.cookies, orgId)
    expect(res.status).toBe(200)
    const entry = res.body.data.find((row: { action: string }) => row.action === "todo.updated")
    expect(entry).toBeDefined()
    expect(entry.changes).toEqual({ is_completed: { from: false, to: true } })
    expect(entry.actor_name).toBe("Owner One")
    expect(entry.actor_id).toBe(owner.userId)
  })

  it("filters by ?action to that action only", async () => {
    const first = await createTodo("First")
    await createTodo("Second")
    await agent()
      .put(`${todosBase()}/${first.body.data.id}`)
      .set("Cookie", owner.cookies)
      .send({ title: "First, edited" })

    const res = await listAuditLogs(owner.cookies, orgId, "?action=todo.created")
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    for (const row of res.body.data) expect(row.action).toBe("todo.created")
    const names = res.body.data.map((row: { entity_name: string }) => row.entity_name)
    expect(names).toEqual(expect.arrayContaining(["First", "Second"]))
  })

  it("matches ?search against entity_name case-insensitively", async () => {
    await createTodo("Alpha Report")
    await createTodo("Beta Note")

    const res = await listAuditLogs(owner.cookies, orgId, "?search=ALPHA")
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].entity_name).toBe("Alpha Report")
  })

  it("paginates with ?limit=2&page=2 and counts all rows", async () => {
    // Three todo creations plus the beforeEach org and project make five entries.
    await createTodo("One")
    await createTodo("Two")
    await createTodo("Three")

    const res = await listAuditLogs(owner.cookies, orgId, "?limit=2&page=2")
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.pagination).toMatchObject({
      current_page: 2,
      items_per_page: 2,
      total_items: 5,
      total_pages: 3,
      has_next_page: true,
      has_previous_page: true,
    })
  })

  it("returns 403 for a member without audit:read and 200 for the owner", async () => {
    // The system member role holds no audit:read; only owner and admin do.
    const member = await signupAndSignin(app)
    const memberRoleId = await getRoleId(prisma, orgId, "member")
    await prisma.orgMember.create({
      data: { orgId, userId: member.userId, roleId: memberRoleId },
    })

    const denied = await listAuditLogs(member.cookies, orgId)
    expect(denied.status).toBe(403)
    const allowed = await listAuditLogs(owner.cookies, orgId)
    expect(allowed.status).toBe(200)
  })
})
