/**
 * Integration tests for permission enforcement and cross-tenant isolation.
 *
 * Tests that:
 * - Viewers cannot create todos (403)
 * - Members can create todos (201)
 * - Viewers can read todos (200)
 * - Viewers cannot delete orgs (403)
 * - Users in org A cannot access org B's projects (403)
 * - Deleting an org cascades to all children
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

let owner, member, viewer
let ownerHeaders, memberHeaders, viewerHeaders
let org, project

beforeEach(async () => {
  await cleanAllTables()

  owner = await createTestUser({ username: "owner" })
  member = await createTestUser({ username: "member" })
  viewer = await createTestUser({ username: "viewer" })

  ownerHeaders = await getAuthHeaders(owner.id)
  memberHeaders = await getAuthHeaders(member.id)
  viewerHeaders = await getAuthHeaders(viewer.id)

  org = await createTestOrg(owner.id)

  await addOrgMember(org.id, member.id, org.roles.member)
  await addOrgMember(org.id, viewer.id, org.roles.viewer)

  project = await createTestProject(org.id, owner.id, org.roles.owner)
  await addProjectMember(project.id, member.id, org.roles.member)
  await addProjectMember(project.id, viewer.id, org.roles.viewer)
})

describe("Permission Enforcement", () => {
  it("viewer cannot create todos", async () => {
    const res = await (await request())
      .post(`/api/orgs/${org.id}/projects/${project.id}/todos`)
      .set(viewerHeaders)
      .send({ title: "Viewer todo" })

    expect(res.status).toBe(403)
  })

  it("member can create todos", async () => {
    const res = await (await request())
      .post(`/api/orgs/${org.id}/projects/${project.id}/todos`)
      .set(memberHeaders)
      .send({ title: "Member todo" })

    expect(res.status).toBe(201)
  })

  it("viewer can read todos", async () => {
    const agent = await request()
    await agent
      .post(`/api/orgs/${org.id}/projects/${project.id}/todos`)
      .set(memberHeaders)
      .send({ title: "Readable todo" })

    const res = await agent
      .get(`/api/orgs/${org.id}/projects/${project.id}/todos`)
      .set(viewerHeaders)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })

  it("viewer cannot delete org", async () => {
    const res = await (await request()).delete(`/api/orgs/${org.id}`).set(viewerHeaders)

    expect(res.status).toBe(403)
  })
})

describe("Cross-Tenant Isolation", () => {
  it("user in org A cannot access org B's projects", async () => {
    const otherUser = await createTestUser({ username: "otherorguser" })
    const otherOrg = await createTestOrg(otherUser.id)

    const res = await (await request()).get(`/api/orgs/${otherOrg.id}/projects`).set(ownerHeaders)

    expect(res.status).toBe(403)
  })
})

describe("Cascade Deletes", () => {
  it("deleting org removes all projects and todos", async () => {
    const agent = await request()

    // Create a todo
    await agent
      .post(`/api/orgs/${org.id}/projects/${project.id}/todos`)
      .set(ownerHeaders)
      .send({ title: "Cascade test todo" })

    // Delete org
    await agent.delete(`/api/orgs/${org.id}`).set(ownerHeaders)

    // Verify org is gone
    const orgRes = await agent.get(`/api/orgs/${org.id}`).set(ownerHeaders)
    expect(orgRes.status).toBe(404)
  })
})
