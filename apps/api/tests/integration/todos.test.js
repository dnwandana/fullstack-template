/**
 * Integration tests for project-scoped todo endpoints.
 *
 * All todo CRUD operations are now scoped to a project within an organization.
 * Routes: /api/orgs/:org_id/projects/:project_id/todos
 */
import {
  request,
  createTestUser,
  getAuthHeaders,
  createTestOrg,
  createTestProject,
  addOrgMember,
  addProjectMember,
  cleanAllTables,
} from "../helpers.js"

let owner, member
let ownerHeaders, memberHeaders
let org, project
let basePath

beforeEach(async () => {
  await cleanAllTables()

  // Create users
  owner = await createTestUser({ username: "owner" })
  member = await createTestUser({ username: "member" })

  ownerHeaders = await getAuthHeaders(owner.id)
  memberHeaders = await getAuthHeaders(member.id)

  // Create org and project
  org = await createTestOrg(owner.id)
  project = await createTestProject(org.id, owner.id, org.roles.owner)

  // Add member to org and project
  await addOrgMember(org.id, member.id, org.roles.member)
  await addProjectMember(project.id, member.id, org.roles.member)

  basePath = `/api/orgs/${org.id}/projects/${project.id}/todos`
})

describe("POST /api/orgs/:org_id/projects/:project_id/todos", () => {
  it("should create a todo", async () => {
    const res = await (await request())
      .post(basePath)
      .set(ownerHeaders)
      .send({ title: "Buy groceries", description: "Milk and eggs" })

    expect(res.status).toBe(201)
    expect(res.body.data.title).toBe("Buy groceries")
    expect(res.body.data.description).toBe("Milk and eggs")
    expect(res.body.data.is_completed).toBe(false)
    expect(res.body.data.id).toBeDefined()
  })

  it("should reject todo without title", async () => {
    const res = await (await request())
      .post(basePath)
      .set(ownerHeaders)
      .send({ description: "No title" })

    expect(res.status).toBe(400)
  })

  it("should require authentication", async () => {
    const res = await (await request()).post(basePath).send({ title: "Unauthorized" })

    expect(res.status).toBe(401)
  })
})

describe("GET /api/orgs/:org_id/projects/:project_id/todos", () => {
  it("should return paginated todos", async () => {
    const agent = await request()

    // Create 3 todos
    for (let i = 1; i <= 3; i++) {
      await agent
        .post(basePath)
        .set(ownerHeaders)
        .send({ title: `Todo ${i}` })
    }

    const res = await agent.get(basePath).set(ownerHeaders)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(3)
    expect(res.body.pagination).toBeDefined()
    expect(res.body.pagination.total_items).toBe(3)
  })

  it("should support search", async () => {
    const agent = await request()
    await agent.post(basePath).set(ownerHeaders).send({ title: "Buy milk" })
    await agent.post(basePath).set(ownerHeaders).send({ title: "Walk the dog" })

    const res = await agent.get(`${basePath}?search=milk`).set(ownerHeaders)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].title).toBe("Buy milk")
  })

  it("should show all project todos regardless of creator", async () => {
    const agent = await request()

    // Owner creates a todo
    await agent.post(basePath).set(ownerHeaders).send({ title: "Owner's todo" })
    // Member creates a todo
    await agent.post(basePath).set(memberHeaders).send({ title: "Member's todo" })

    // Both users should see both todos (scoped by project, not user)
    const ownerRes = await agent.get(basePath).set(ownerHeaders)
    expect(ownerRes.body.data).toHaveLength(2)

    const memberRes = await agent.get(basePath).set(memberHeaders)
    expect(memberRes.body.data).toHaveLength(2)
  })
})

describe("GET /api/orgs/:org_id/projects/:project_id/todos/:todo_id", () => {
  it("should return a single todo", async () => {
    const agent = await request()
    const createRes = await agent.post(basePath).set(ownerHeaders).send({ title: "Specific todo" })

    const todoId = createRes.body.data.id
    const res = await agent.get(`${basePath}/${todoId}`).set(ownerHeaders)

    expect(res.status).toBe(200)
    expect(res.body.data.title).toBe("Specific todo")
  })

  it("should reject invalid UUID", async () => {
    const res = await (await request()).get(`${basePath}/not-a-uuid`).set(ownerHeaders)

    expect(res.status).toBe(400)
  })
})

describe("PUT /api/orgs/:org_id/projects/:project_id/todos/:todo_id", () => {
  it("should update a todo", async () => {
    const agent = await request()
    const createRes = await agent.post(basePath).set(ownerHeaders).send({ title: "Original title" })

    const todoId = createRes.body.data.id
    const res = await agent
      .put(`${basePath}/${todoId}`)
      .set(ownerHeaders)
      .send({ title: "Updated title", is_completed: true })

    expect(res.status).toBe(200)
    expect(res.body.data.title).toBe("Updated title")
    expect(res.body.data.is_completed).toBe(true)
  })
})

describe("DELETE /api/orgs/:org_id/projects/:project_id/todos/:todo_id", () => {
  it("should delete a todo", async () => {
    const agent = await request()
    const createRes = await agent.post(basePath).set(ownerHeaders).send({ title: "To be deleted" })

    const todoId = createRes.body.data.id
    const res = await agent.delete(`${basePath}/${todoId}`).set(ownerHeaders)

    expect(res.status).toBe(200)

    // Verify it's gone
    const getRes = await agent.get(`${basePath}/${todoId}`).set(ownerHeaders)
    expect(getRes.status).toBe(404)
  })
})

describe("DELETE /api/orgs/:org_id/projects/:project_id/todos (bulk)", () => {
  it("should delete multiple todos", async () => {
    const agent = await request()
    const ids = []
    for (let i = 0; i < 3; i++) {
      const createRes = await agent
        .post(basePath)
        .set(ownerHeaders)
        .send({ title: `Bulk delete ${i}` })
      ids.push(createRes.body.data.id)
    }

    const res = await agent.delete(`${basePath}?ids=${ids.join(",")}`).set(ownerHeaders)

    expect(res.status).toBe(200)

    // Verify they're gone
    const listRes = await agent.get(basePath).set(ownerHeaders)
    expect(listRes.body.data).toHaveLength(0)
  })

  it("should reject invalid UUIDs in bulk delete", async () => {
    const res = await (await request())
      .delete(`${basePath}?ids=not-a-uuid,also-bad`)
      .set(ownerHeaders)

    expect(res.status).toBe(400)
  })
})
