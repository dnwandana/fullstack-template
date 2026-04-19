import {
  request,
  createTestUser,
  getAuthHeaders,
  createTestOrg,
  createTestProject,
  cleanAllTables,
  addOrgMember,
  addProjectMember,
} from "../helpers.js"

afterEach(async () => {
  await cleanAllTables()
})

describe("GET /api/orgs/:org_id/projects", () => {
  it("should show all org projects to org owner even without project membership", async () => {
    const owner = await createTestUser()
    const org = await createTestOrg(owner.id)
    const ownerHeaders = await getAuthHeaders(owner.id)

    // Another user creates a project in the same org
    const member = await createTestUser({ username: "member1" })
    await addOrgMember(org.id, member.id, org.roles.admin)
    const memberHeaders = await getAuthHeaders(member.id)

    const projectRes = await (await request())
      .post(`/api/orgs/${org.id}/projects`)
      .set(memberHeaders)
      .send({ name: "Member Project" })

    expect(projectRes.status).toBe(201)
    const projectId = projectRes.body.data.id

    // Remove owner from project membership (they were auto-added by createProject)
    const { default: db } = await import("../../src/config/database.js")
    await db("project_members").where({ project_id: projectId, user_id: owner.id }).del()

    // Owner should still see the project via findManyByOrgId
    const listRes = await (await request()).get(`/api/orgs/${org.id}/projects`).set(ownerHeaders)

    expect(listRes.status).toBe(200)
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1)
    expect(listRes.body.data.some((p) => p.id === projectId)).toBe(true)
  })

  it("should only show member-scoped projects to regular member", async () => {
    const owner = await createTestUser()
    const org = await createTestOrg(owner.id)

    // Create two projects as owner
    const project1 = await createTestProject(org.id, owner.id, org.roles.member, {
      name: "Project 1",
    })
    await createTestProject(org.id, owner.id, org.roles.member, {
      name: "Project 2",
    })

    // Add member only to project1
    const member = await createTestUser({ username: "member2" })
    await addOrgMember(org.id, member.id, org.roles.member)
    await addProjectMember(project1.id, member.id, org.roles.member)
    const memberHeaders = await getAuthHeaders(member.id)

    const listRes = await (await request()).get(`/api/orgs/${org.id}/projects`).set(memberHeaders)

    expect(listRes.status).toBe(200)
    expect(listRes.body.data).toHaveLength(1)
    expect(listRes.body.data[0].id).toBe(project1.id)
  })
})
