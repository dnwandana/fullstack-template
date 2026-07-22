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

describe("Invitee backfill on signup", () => {
  it("should surface a pre-signup invitation in GET /api/invitations after registering", async () => {
    const inviter = await createTestUser()
    const org = await createTestOrg(inviter.id)
    const inviterHeaders = await getAuthHeaders(inviter.id)

    await (
      await request()
    )
      .post(`/api/orgs/${org.id}/invitations`)
      .set(inviterHeaders)
      .send({ email: "backfill@test.com", role_id: org.roles.member })

    await (await request()).post("/api/auth/signup").send({
      name: "Backfill User",
      email: "backfill@test.com",
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
    })

    const signinRes = await (
      await request()
    )
      .post("/api/auth/signin")
      .send({ email: "backfill@test.com", password: "Testpass123!" })

    const listRes = await (
      await request()
    )
      .get("/api/invitations")
      .set("Cookie", extractCookies(signinRes))

    expect(listRes.status).toBe(200)
    expect(listRes.body.data).toHaveLength(1)
    expect(listRes.body.data[0].invitee_email).toBe("backfill@test.com")
    expect(listRes.body.data[0].org_name).toBe(org.name)
  })

  it("should not link invitations belonging to a different email", async () => {
    const inviter = await createTestUser()
    const org = await createTestOrg(inviter.id)
    const inviterHeaders = await getAuthHeaders(inviter.id)

    await (
      await request()
    )
      .post(`/api/orgs/${org.id}/invitations`)
      .set(inviterHeaders)
      .send({ email: "someone-else@test.com", role_id: org.roles.member })

    await (await request()).post("/api/auth/signup").send({
      name: "Unrelated User",
      email: "unrelated@test.com",
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
    })

    const signinRes = await (
      await request()
    )
      .post("/api/auth/signin")
      .send({ email: "unrelated@test.com", password: "Testpass123!" })

    const listRes = await (
      await request()
    )
      .get("/api/invitations")
      .set("Cookie", extractCookies(signinRes))

    expect(listRes.body.data).toHaveLength(0)
  })
})

describe("Public invitation preview", () => {
  const createInvite = async (email) => {
    const inviter = await createTestUser({ name: "Ada Lovelace" })
    const org = await createTestOrg(inviter.id)
    const headers = await getAuthHeaders(inviter.id)
    const res = await (
      await request()
    )
      .post(`/api/orgs/${org.id}/invitations`)
      .set(headers)
      .send({ email, role_id: org.roles.member })
    return { org, invitation: res.body.data }
  }

  it("should return invitation context without authentication", async () => {
    const { org, invitation } = await createInvite("preview@test.com")

    const res = await (
      await request()
    ).get(`/api/invitations/${invitation.id}/preview?token=${invitation.token}`)

    expect(res.status).toBe(200)
    expect(res.body.data.org_name).toBe(org.name)
    expect(res.body.data.inviter_name).toBe("Ada Lovelace")
    expect(res.body.data.role_name).toBe("member")
    expect(res.body.data.invitee_email).toBe("preview@test.com")
    expect(res.body.data.is_expired).toBe(false)
    expect(res.body.data.requires_signup).toBe(true)
  })

  it("should never expose the token or its hash", async () => {
    const { invitation } = await createInvite("preview2@test.com")

    const res = await (
      await request()
    ).get(`/api/invitations/${invitation.id}/preview?token=${invitation.token}`)

    expect(res.body.data.token).toBeUndefined()
    expect(res.body.data.token_hash).toBeUndefined()
  })

  it("should 404 on a wrong token rather than confirming the invitation exists", async () => {
    const { invitation } = await createInvite("preview3@test.com")

    const res = await (
      await request()
    ).get(`/api/invitations/${invitation.id}/preview?token=${"a".repeat(64)}`)

    expect(res.status).toBe(404)
  })

  it("should 400 on a malformed token", async () => {
    const { invitation } = await createInvite("preview4@test.com")

    const res = await (await request()).get(`/api/invitations/${invitation.id}/preview?token=nope`)

    expect(res.status).toBe(400)
  })

  it("should keep the auth barrier intact for every other /api/invitations route", async () => {
    const { invitation } = await createInvite("barrier@test.com")

    const listRes = await (await request()).get("/api/invitations")
    expect(listRes.status).toBe(401)

    const acceptRes = await (
      await request()
    )
      .post(`/api/invitations/${invitation.id}/accept`)
      .send({ token: invitation.token })
    expect(acceptRes.status).toBe(401)

    const declineRes = await (await request()).post(`/api/invitations/${invitation.id}/decline`)
    expect(declineRes.status).toBe(401)
  })

  it("should report requires_signup false when the invitee already has an account", async () => {
    const existing = await createTestUser({ email: "existing@test.com" })
    const { invitation } = await createInvite(existing.email)

    const res = await (
      await request()
    ).get(`/api/invitations/${invitation.id}/preview?token=${invitation.token}`)

    expect(res.body.data.requires_signup).toBe(false)
  })
})

describe("Invitation accept URL", () => {
  it("should return an accept_url containing the id and raw token", async () => {
    const inviter = await createTestUser()
    const org = await createTestOrg(inviter.id)
    const headers = await getAuthHeaders(inviter.id)

    const res = await (
      await request()
    )
      .post(`/api/orgs/${org.id}/invitations`)
      .set(headers)
      .send({ email: "url@test.com", role_id: org.roles.member })

    const { id, token, accept_url: acceptUrl } = res.body.data
    expect(acceptUrl).toContain(`/invite/${id}`)
    expect(acceptUrl).toContain(`token=${token}`)
  })
})

describe("Resend invitation", () => {
  it("should issue a new token and invalidate the old one", async () => {
    const inviter = await createTestUser()
    const org = await createTestOrg(inviter.id)
    const headers = await getAuthHeaders(inviter.id)

    const createRes = await (
      await request()
    )
      .post(`/api/orgs/${org.id}/invitations`)
      .set(headers)
      .send({ email: "resend@test.com", role_id: org.roles.member })

    const { id, token: oldToken } = createRes.body.data

    const resendRes = await (
      await request()
    )
      .post(`/api/orgs/${org.id}/invitations/${id}/resend`)
      .set(headers)

    expect(resendRes.status).toBe(200)
    const newToken = resendRes.body.data.token
    expect(newToken).toHaveLength(64)
    expect(newToken).not.toBe(oldToken)
    expect(resendRes.body.data.accept_url).toContain(`token=${newToken}`)

    const oldPreview = await (
      await request()
    ).get(`/api/invitations/${id}/preview?token=${oldToken}`)
    expect(oldPreview.status).toBe(404)

    const newPreview = await (
      await request()
    ).get(`/api/invitations/${id}/preview?token=${newToken}`)
    expect(newPreview.status).toBe(200)
  })

  it("should refuse to resend an invitation that is no longer pending", async () => {
    const inviter = await createTestUser()
    const invitee = await createTestUser({ email: "declines@test.com" })
    const org = await createTestOrg(inviter.id)
    const headers = await getAuthHeaders(inviter.id)
    const inviteeHeaders = await getAuthHeaders(invitee.id)

    const createRes = await (
      await request()
    )
      .post(`/api/orgs/${org.id}/invitations`)
      .set(headers)
      .send({ email: invitee.email, role_id: org.roles.member })

    const { id } = createRes.body.data
    await (await request()).post(`/api/invitations/${id}/decline`).set(inviteeHeaders)

    const resendRes = await (
      await request()
    )
      .post(`/api/orgs/${org.id}/invitations/${id}/resend`)
      .set(headers)

    expect(resendRes.status).toBe(400)
  })

  it("should not resend an invitation belonging to another org", async () => {
    const inviterA = await createTestUser()
    const inviterB = await createTestUser()
    const orgA = await createTestOrg(inviterA.id)
    const orgB = await createTestOrg(inviterB.id)
    const headersA = await getAuthHeaders(inviterA.id)
    const headersB = await getAuthHeaders(inviterB.id)

    const createRes = await (
      await request()
    )
      .post(`/api/orgs/${orgA.id}/invitations`)
      .set(headersA)
      .send({ email: "cross@test.com", role_id: orgA.roles.member })

    const resendRes = await (
      await request()
    )
      .post(`/api/orgs/${orgB.id}/invitations/${createRes.body.data.id}/resend`)
      .set(headersB)

    expect(resendRes.status).toBe(404)
  })
})
