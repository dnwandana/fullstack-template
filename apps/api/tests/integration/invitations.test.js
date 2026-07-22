import crypto from "node:crypto"
import {
  request,
  createTestUser,
  getAuthHeaders,
  createTestOrg,
  createTestProject,
  cleanAllTables,
  extractCookies,
} from "../helpers.js"

afterEach(async () => {
  await cleanAllTables()
})

describe("Invitation Security (C2, C3, C4, H7)", () => {
  describe("C2: Token not leaked in API responses", () => {
    it("should NOT include token in org invitation listing", async () => {
      const inviter = await createTestUser()
      const org = await createTestOrg(inviter.id)
      const invitee = await createTestUser()
      const inviterHeaders = await getAuthHeaders(inviter.id)

      await (
        await request()
      )
        .post(`/api/orgs/${org.id}/invitations`)
        .set(inviterHeaders)
        .send({ email: invitee.email, role_id: org.roles.member })

      const listRes = await (
        await request()
      )
        .get(`/api/orgs/${org.id}/invitations`)
        .set(inviterHeaders)

      expect(listRes.status).toBe(200)
      expect(listRes.body.data[0].token).toBeUndefined()
      expect(listRes.body.data[0].token_hash).toBeUndefined()
    })

    it("should NOT include token in user's pending invitations", async () => {
      const inviter = await createTestUser()
      const org = await createTestOrg(inviter.id)
      const invitee = await createTestUser()
      const inviterHeaders = await getAuthHeaders(inviter.id)
      const inviteeHeaders = await getAuthHeaders(invitee.id)

      await (
        await request()
      )
        .post(`/api/orgs/${org.id}/invitations`)
        .set(inviterHeaders)
        .send({ email: invitee.email, role_id: org.roles.member })

      const myRes = await (await request()).get("/api/invitations").set(inviteeHeaders)

      expect(myRes.status).toBe(200)
      expect(myRes.body.data[0].token).toBeUndefined()
      expect(myRes.body.data[0].token_hash).toBeUndefined()
    })

    it("should return raw token on creation (one-time view)", async () => {
      const inviter = await createTestUser()
      const org = await createTestOrg(inviter.id)
      const invitee = await createTestUser()
      const inviterHeaders = await getAuthHeaders(inviter.id)

      const createRes = await (
        await request()
      )
        .post(`/api/orgs/${org.id}/invitations`)
        .set(inviterHeaders)
        .send({ email: invitee.email, role_id: org.roles.member })

      expect(createRes.status).toBe(201)
      expect(createRes.body.data.token).toBeDefined()
      expect(createRes.body.data.token).toHaveLength(64)
    })
  })

  describe("C3: Token validation on accept", () => {
    it("should accept invitation with valid token", async () => {
      const inviter = await createTestUser()
      const org = await createTestOrg(inviter.id)
      const invitee = await createTestUser()
      const inviterHeaders = await getAuthHeaders(inviter.id)
      const inviteeHeaders = await getAuthHeaders(invitee.id)

      const createRes = await (
        await request()
      )
        .post(`/api/orgs/${org.id}/invitations`)
        .set(inviterHeaders)
        .send({ email: invitee.email, role_id: org.roles.member })

      const invitationId = createRes.body.data.id
      const rawToken = createRes.body.data.token

      const acceptRes = await (
        await request()
      )
        .post(`/api/invitations/${invitationId}/accept`)
        .set(inviteeHeaders)
        .send({ token: rawToken })

      expect(acceptRes.status).toBe(200)
    })

    it("should reject acceptance with wrong token", async () => {
      const inviter = await createTestUser()
      const org = await createTestOrg(inviter.id)
      const invitee = await createTestUser()
      const inviterHeaders = await getAuthHeaders(inviter.id)
      const inviteeHeaders = await getAuthHeaders(invitee.id)

      const createRes = await (
        await request()
      )
        .post(`/api/orgs/${org.id}/invitations`)
        .set(inviterHeaders)
        .send({ email: invitee.email, role_id: org.roles.member })

      const invitationId = createRes.body.data.id

      const acceptRes = await (
        await request()
      )
        .post(`/api/invitations/${invitationId}/accept`)
        .set(inviteeHeaders)
        .send({ token: crypto.randomBytes(32).toString("hex") })

      expect(acceptRes.status).toBe(403)
      expect(acceptRes.body.message).toContain("Invalid invitation token")
    })

    it("should reject acceptance without token", async () => {
      const inviter = await createTestUser()
      const org = await createTestOrg(inviter.id)
      const invitee = await createTestUser()
      const inviterHeaders = await getAuthHeaders(inviter.id)
      const inviteeHeaders = await getAuthHeaders(invitee.id)

      const createRes = await (
        await request()
      )
        .post(`/api/orgs/${org.id}/invitations`)
        .set(inviterHeaders)
        .send({ email: invitee.email, role_id: org.roles.member })

      const invitationId = createRes.body.data.id

      const acceptRes = await (
        await request()
      )
        .post(`/api/invitations/${invitationId}/accept`)
        .set(inviteeHeaders)
        .send({})

      expect(acceptRes.status).toBe(400)
    })
  })

  describe("C4: Email-only invitation acceptance", () => {
    it("should allow accepting email-only invite by matching email", async () => {
      const inviter = await createTestUser()
      const org = await createTestOrg(inviter.id)
      const inviterHeaders = await getAuthHeaders(inviter.id)

      const createRes = await (
        await request()
      )
        .post(`/api/orgs/${org.id}/invitations`)
        .set(inviterHeaders)
        .send({ email: "newuser@test.com", role_id: org.roles.member })

      const invitationId = createRes.body.data.id
      const rawToken = createRes.body.data.token

      const signupRes = await (await request()).post("/api/auth/signup").send({
        name: "New User",
        email: "newuser@test.com",
        password: "Testpass123!",
        confirmation_password: "Testpass123!",
      })
      expect(signupRes.status).toBe(201)

      const signinRes = await (await request()).post("/api/auth/signin").send({
        email: "newuser@test.com",
        password: "Testpass123!",
      })

      const newUserCookie = extractCookies(signinRes)

      const acceptRes = await (
        await request()
      )
        .post(`/api/invitations/${invitationId}/accept`)
        .set("Cookie", newUserCookie)
        .send({ token: rawToken })

      expect(acceptRes.status).toBe(200)
    })

    it("should reject email-only invite if emails do not match", async () => {
      const inviter = await createTestUser()
      const org = await createTestOrg(inviter.id)
      const inviterHeaders = await getAuthHeaders(inviter.id)

      const createRes = await (
        await request()
      )
        .post(`/api/orgs/${org.id}/invitations`)
        .set(inviterHeaders)
        .send({ email: "target@test.com", role_id: org.roles.member })

      const invitationId = createRes.body.data.id
      const rawToken = createRes.body.data.token

      await (await request()).post("/api/auth/signup").send({
        name: "Wrong User",
        email: "wrong@test.com",
        password: "Testpass123!",
        confirmation_password: "Testpass123!",
      })

      const signinRes = await (await request()).post("/api/auth/signin").send({
        email: "wrong@test.com",
        password: "Testpass123!",
      })

      const wrongUserCookie = extractCookies(signinRes)

      const acceptRes = await (
        await request()
      )
        .post(`/api/invitations/${invitationId}/accept`)
        .set("Cookie", wrongUserCookie)
        .send({ token: rawToken })

      expect(acceptRes.status).toBe(403)
    })
  })
})

describe("Email-only invitations", () => {
  it("should reject an invite payload without email", async () => {
    const inviter = await createTestUser()
    const org = await createTestOrg(inviter.id)
    const inviterHeaders = await getAuthHeaders(inviter.id)

    const res = await (
      await request()
    )
      .post(`/api/orgs/${org.id}/invitations`)
      .set(inviterHeaders)
      .send({ username: "someone", role_id: org.roles.member })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain("email")
  })
})

describe("Email normalization on invitations", () => {
  it("should resolve a mixed-case invite to an existing lowercase account", async () => {
    const inviter = await createTestUser()
    const org = await createTestOrg(inviter.id)
    const inviterHeaders = await getAuthHeaders(inviter.id)

    const invitee = await createTestUser({ email: "mixed@case.com" })
    const inviteeHeaders = await getAuthHeaders(invitee.id)

    const createRes = await (
      await request()
    )
      .post(`/api/orgs/${org.id}/invitations`)
      .set(inviterHeaders)
      .send({ email: "Mixed@Case.COM", role_id: org.roles.member })

    expect(createRes.status).toBe(201)
    expect(createRes.body.data.invitee_id).toBe(invitee.id)

    const myRes = await (await request()).get("/api/invitations").set(inviteeHeaders)

    expect(myRes.status).toBe(200)
    expect(myRes.body.data).toHaveLength(1)
  })
})

/** Sends an invitation to the given org- or project-scoped invitations path. */
const invite = async (headers, path, email, roleId) =>
  (await request()).post(path).set(headers).send({ email, role_id: roleId })

describe("Duplicate pending invitations", () => {
  it("should reject a second pending invitation for the same email", async () => {
    const inviter = await createTestUser()
    const org = await createTestOrg(inviter.id)
    const headers = await getAuthHeaders(inviter.id)
    const path = `/api/orgs/${org.id}/invitations`

    const first = await invite(headers, path, "dupe@test.com", org.roles.member)
    expect(first.status).toBe(201)

    const second = await invite(headers, path, "dupe@test.com", org.roles.member)
    expect(second.status).toBe(400)
    expect(second.body.message).toContain("pending invitation already exists")
  })

  it("should allow re-inviting after the first invitation is revoked", async () => {
    const inviter = await createTestUser()
    const org = await createTestOrg(inviter.id)
    const headers = await getAuthHeaders(inviter.id)
    const path = `/api/orgs/${org.id}/invitations`

    const first = await invite(headers, path, "revoked@test.com", org.roles.member)
    await (await request()).delete(`${path}/${first.body.data.id}`).set(headers)

    const second = await invite(headers, path, "revoked@test.com", org.roles.member)
    expect(second.status).toBe(201)
  })

  it("should not let a pending org invite block a project invite for the same email", async () => {
    const inviter = await createTestUser()
    const org = await createTestOrg(inviter.id)
    const project = await createTestProject(org.id, inviter.id, org.roles.owner)
    const headers = await getAuthHeaders(inviter.id)

    await invite(headers, `/api/orgs/${org.id}/invitations`, "scoped@test.com", org.roles.member)

    const projectRes = await invite(
      headers,
      `/api/orgs/${org.id}/projects/${project.id}/invitations`,
      "scoped@test.com",
      org.roles.member,
    )

    expect(projectRes.status).toBe(201)
  })
})
