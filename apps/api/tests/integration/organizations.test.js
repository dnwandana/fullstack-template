/**
 * Integration tests for organization CRUD endpoints.
 * Routes: /api/orgs
 */
import { request, createTestUser, getAuthHeaders, cleanAllTables } from "../helpers.js"

let user
let headers

beforeEach(async () => {
  await cleanAllTables()
  user = await createTestUser()
  headers = await getAuthHeaders(user.id)
})

describe("POST /api/orgs", () => {
  it("should create an organization", async () => {
    const res = await (await request())
      .post("/api/orgs")
      .set(headers)
      .send({ name: "Test Org", description: "A test organization" })

    expect(res.status).toBe(201)
    expect(res.body.data.name).toBe("Test Org")
    expect(res.body.data.id).toBeDefined()
  })

  it("should reject org without name", async () => {
    const res = await (await request())
      .post("/api/orgs")
      .set(headers)
      .send({ description: "No name" })

    expect(res.status).toBe(400)
  })

  it("should require authentication", async () => {
    const res = await (await request()).post("/api/orgs").send({ name: "No Auth" })

    expect(res.status).toBe(401)
  })

  it("should make the creator the owner", async () => {
    const agent = await request()
    const createRes = await agent.post("/api/orgs").set(headers).send({ name: "Owner Test Org" })

    const orgId = createRes.body.data.id

    // Creator should be able to delete (owner permission)
    const deleteRes = await agent.delete(`/api/orgs/${orgId}`).set(headers)
    expect(deleteRes.status).toBe(200)
  })
})

describe("GET /api/orgs", () => {
  it("should list user's organizations", async () => {
    const agent = await request()
    await agent.post("/api/orgs").set(headers).send({ name: "Org 1" })
    await agent.post("/api/orgs").set(headers).send({ name: "Org 2" })

    const res = await agent.get("/api/orgs").set(headers)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
  })

  it("should not return orgs the user is not a member of", async () => {
    const agent = await request()
    const otherUser = await createTestUser({ username: "otheruser" })
    const otherHeaders = await getAuthHeaders(otherUser.id)

    await agent.post("/api/orgs").set(otherHeaders).send({ name: "Other Org" })

    const res = await agent.get("/api/orgs").set(headers)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
  })
})

describe("GET /api/orgs/:org_id", () => {
  it("should return org details", async () => {
    const agent = await request()
    const createRes = await agent
      .post("/api/orgs")
      .set(headers)
      .send({ name: "Detail Org", description: "Details" })

    const orgId = createRes.body.data.id
    const res = await agent.get(`/api/orgs/${orgId}`).set(headers)

    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe("Detail Org")
  })

  it("should return 403 for non-member", async () => {
    const agent = await request()
    const createRes = await agent.post("/api/orgs").set(headers).send({ name: "Private Org" })
    const orgId = createRes.body.data.id

    const otherUser = await createTestUser({ username: "outsider" })
    const otherHeaders = await getAuthHeaders(otherUser.id)

    const res = await agent.get(`/api/orgs/${orgId}`).set(otherHeaders)

    expect(res.status).toBe(403)
  })
})

describe("PUT /api/orgs/:org_id", () => {
  it("should update org name", async () => {
    const agent = await request()
    const createRes = await agent.post("/api/orgs").set(headers).send({ name: "Old Name" })
    const orgId = createRes.body.data.id

    const res = await agent.put(`/api/orgs/${orgId}`).set(headers).send({ name: "New Name" })

    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe("New Name")
  })
})

describe("DELETE /api/orgs/:org_id", () => {
  it("should delete an organization", async () => {
    const agent = await request()
    const createRes = await agent.post("/api/orgs").set(headers).send({ name: "To Delete" })
    const orgId = createRes.body.data.id

    const res = await agent.delete(`/api/orgs/${orgId}`).set(headers)

    expect(res.status).toBe(200)

    // Verify it's gone — returns 404 because org no longer exists
    const getRes = await agent.get(`/api/orgs/${orgId}`).set(headers)
    expect(getRes.status).toBe(404)
  })
})
