import crypto from "node:crypto"
import {
  request,
  createTestUser,
  getAuthHeaders,
  createTestOrg,
  cleanAllTables,
} from "../helpers.js"

afterEach(async () => {
  await cleanAllTables()
})

describe("Invitation Security (C2, C3, C4, H7)", () => {
  describe("C2: Token not leaked in API responses", () => {
    it("should NOT include token in org invitation listing", async () => {
      const inviter = await createTestUser()
      const org = await createTestOrg(inviter.id)
      const invitee = await createTestUser({ username: "invitee1" })
      const inviterHeaders = await getAuthHeaders(inviter.id)

      await (await request())
        .post(`/api/orgs/${org.id}/invitations`)
        .set(inviterHeaders)
        .send({ username: invitee.username, role_id: org.roles.member })

      const listRes = await (await request())
        .get(`/api/orgs/${org.id}/invitations`)
        .set(inviterHeaders)

      expect(listRes.status).toBe(200)
      expect(listRes.body.data[0].token).toBeUndefined()
      expect(listRes.body.data[0].token_hash).toBeUndefined()
    })

    it("should NOT include token in user's pending invitations", async () => {
      const inviter = await createTestUser()
      const org = await createTestOrg(inviter.id)
      const invitee = await createTestUser({ username: "invitee2" })
      const inviterHeaders = await getAuthHeaders(inviter.id)
      const inviteeHeaders = await getAuthHeaders(invitee.id)

      await (await request())
        .post(`/api/orgs/${org.id}/invitations`)
        .set(inviterHeaders)
        .send({ username: invitee.username, role_id: org.roles.member })

      const myRes = await (await request()).get("/api/invitations").set(inviteeHeaders)

      expect(myRes.status).toBe(200)
      expect(myRes.body.data[0].token).toBeUndefined()
      expect(myRes.body.data[0].token_hash).toBeUndefined()
    })

    it("should return raw token on creation (one-time view)", async () => {
      const inviter = await createTestUser()
      const org = await createTestOrg(inviter.id)
      const invitee = await createTestUser({ username: "invitee3" })
      const inviterHeaders = await getAuthHeaders(inviter.id)

      const createRes = await (await request())
        .post(`/api/orgs/${org.id}/invitations`)
        .set(inviterHeaders)
        .send({ username: invitee.username, role_id: org.roles.member })

      expect(createRes.status).toBe(201)
      expect(createRes.body.data.token).toBeDefined()
      expect(createRes.body.data.token).toHaveLength(64)
    })
  })

  describe("C3: Token validation on accept", () => {
    it("should accept invitation with valid token", async () => {
      const inviter = await createTestUser()
      const org = await createTestOrg(inviter.id)
      const invitee = await createTestUser({ username: "invitee4" })
      const inviterHeaders = await getAuthHeaders(inviter.id)
      const inviteeHeaders = await getAuthHeaders(invitee.id)

      const createRes = await (await request())
        .post(`/api/orgs/${org.id}/invitations`)
        .set(inviterHeaders)
        .send({ username: invitee.username, role_id: org.roles.member })

      const invitationId = createRes.body.data.id
      const rawToken = createRes.body.data.token

      const acceptRes = await (await request())
        .post(`/api/invitations/${invitationId}/accept`)
        .set(inviteeHeaders)
        .send({ token: rawToken })

      expect(acceptRes.status).toBe(200)
    })

    it("should reject acceptance with wrong token", async () => {
      const inviter = await createTestUser()
      const org = await createTestOrg(inviter.id)
      const invitee = await createTestUser({ username: "invitee5" })
      const inviterHeaders = await getAuthHeaders(inviter.id)
      const inviteeHeaders = await getAuthHeaders(invitee.id)

      const createRes = await (await request())
        .post(`/api/orgs/${org.id}/invitations`)
        .set(inviterHeaders)
        .send({ username: invitee.username, role_id: org.roles.member })

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
      const invitee = await createTestUser({ username: "invitee6" })
      const inviterHeaders = await getAuthHeaders(inviter.id)
      const inviteeHeaders = await getAuthHeaders(invitee.id)

      const createRes = await (await request())
        .post(`/api/orgs/${org.id}/invitations`)
        .set(inviterHeaders)
        .send({ username: invitee.username, role_id: org.roles.member })

      const invitationId = createRes.body.data.id

      const acceptRes = await (await request())
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

      const createRes = await (await request())
        .post(`/api/orgs/${org.id}/invitations`)
        .set(inviterHeaders)
        .send({ email: "newuser@test.com", role_id: org.roles.member })

      const invitationId = createRes.body.data.id
      const rawToken = createRes.body.data.token

      const signupRes = await (await request()).post("/api/auth/signup").send({
        username: "newuser",
        email: "newuser@test.com",
        password: "Testpass123!",
        confirmation_password: "Testpass123!",
      })
      expect(signupRes.status).toBe(201)

      const signinRes = await (await request()).post("/api/auth/signin").send({
        username: "newuser",
        password: "Testpass123!",
      })

      const setCookieHeader = signinRes.headers["set-cookie"]
      const newUserCookie = Array.isArray(setCookieHeader)
        ? setCookieHeader.map((c) => c.split(";")[0]).join("; ")
        : setCookieHeader.split(";")[0]

      const acceptRes = await (await request())
        .post(`/api/invitations/${invitationId}/accept`)
        .set("Cookie", newUserCookie)
        .send({ token: rawToken })

      expect(acceptRes.status).toBe(200)
    })

    it("should reject email-only invite if emails do not match", async () => {
      const inviter = await createTestUser()
      const org = await createTestOrg(inviter.id)
      const inviterHeaders = await getAuthHeaders(inviter.id)

      const createRes = await (await request())
        .post(`/api/orgs/${org.id}/invitations`)
        .set(inviterHeaders)
        .send({ email: "target@test.com", role_id: org.roles.member })

      const invitationId = createRes.body.data.id
      const rawToken = createRes.body.data.token

      await (await request()).post("/api/auth/signup").send({
        username: "wronguser",
        email: "wrong@test.com",
        password: "Testpass123!",
        confirmation_password: "Testpass123!",
      })

      const signinRes = await (await request()).post("/api/auth/signin").send({
        username: "wronguser",
        password: "Testpass123!",
      })

      const setCookieHeader = signinRes.headers["set-cookie"]
      const wrongUserCookie = Array.isArray(setCookieHeader)
        ? setCookieHeader.map((c) => c.split(";")[0]).join("; ")
        : setCookieHeader.split(";")[0]

      const acceptRes = await (await request())
        .post(`/api/invitations/${invitationId}/accept`)
        .set("Cookie", wrongUserCookie)
        .send({ token: rawToken })

      expect(acceptRes.status).toBe(403)
    })
  })
})
