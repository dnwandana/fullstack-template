import { Test } from "@nestjs/testing"
import { INestApplication } from "@nestjs/common"
import request from "supertest"
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/bootstrap"
import { PrismaService } from "../src/prisma/prisma.service"
import { truncateAll, seedPermissions } from "./setup-e2e"
import { signupAndSignin, createOrg, getRoleId } from "./factory"

// These tests live in their own spec file on purpose: test/invitations.e2e-spec.ts
// already spends ~40 of the 50 requests the AuthController throttle allows per app,
// and each setup below spends 4 more. The counter is per-app, and every spec file
// builds its own app, so a separate file resets it. Budget here: 4 × 4 = 16 / 50.
describe("Invitation accept requires the raw token (e2e)", () => {
  let app: INestApplication
  let prisma: PrismaService
  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = ref.createNestApplication({ bufferLogs: true })
    configureApp(app)
    await app.init()
    prisma = app.get(PrismaService)
  })
  beforeEach(async () => {
    await truncateAll(prisma)
    await seedPermissions(prisma)
  })
  afterAll(async () => app.close())
  const agent = () => request(app.getHttpServer())

  // Signs up an owner, creates an org, invites invitee@x.io, signs that invitee in,
  // and creates a SECOND invitation (different email, so the duplicate-pending guard
  // does not fire) whose token is real but belongs elsewhere. Auth requests: 4.
  async function setupPendingInvitation() {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const memberRoleId = await getRoleId(prisma, org.id, "member")

    const created = await agent()
      .post(`/api/orgs/${org.id}/invitations`)
      .set("Cookie", owner.cookies)
      .send({ email: "invitee@x.io", role_id: memberRoleId })
    expect(created.status).toBe(201)

    const other = await agent()
      .post(`/api/orgs/${org.id}/invitations`)
      .set("Cookie", owner.cookies)
      .send({ email: "other@x.io", role_id: memberRoleId })
    expect(other.status).toBe(201)

    const invitee = await signupAndSignin(app, { email: "invitee@x.io" })
    return {
      orgId: org.id,
      invitationId: created.body.data.id as string,
      token: created.body.data.token as string,
      otherToken: other.body.data.token as string,
      inviteeCookies: invitee.cookies,
    }
  }

  it("rejects accept without a token", async () => {
    const { inviteeCookies, invitationId } = await setupPendingInvitation()

    const res = await agent()
      .post(`/api/invitations/${invitationId}/accept`)
      .set("Cookie", inviteeCookies)
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("token must be a 64-character hex string")
    expect(res.body.data).toBeNull()
    // The invitation is untouched — a bodyless accept must not consume it.
    const row = await prisma.invitation.findUnique({ where: { id: invitationId } })
    expect(row?.status).toBe("pending")
  })

  it("rejects accept with a malformed token", async () => {
    const { inviteeCookies, invitationId } = await setupPendingInvitation()

    const res = await agent()
      .post(`/api/invitations/${invitationId}/accept`)
      .set("Cookie", inviteeCookies)
      .send({ token: "nothex" })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("token must be a 64-character hex string")
    expect(res.body.data).toBeNull()
  })

  it("rejects accept with a token belonging to a different invitation", async () => {
    const { inviteeCookies, invitationId, otherToken } = await setupPendingInvitation()

    const res = await agent()
      .post(`/api/invitations/${invitationId}/accept`)
      .set("Cookie", inviteeCookies)
      .send({ token: otherToken })

    expect(res.status).toBe(404)
    expect(res.body.message).toBe("Invitation not found")
    expect(res.body.data).toBeNull()
    // The invitation is untouched — a wrong token must not consume it.
    const row = await prisma.invitation.findUnique({ where: { id: invitationId } })
    expect(row?.status).toBe("pending")
  })

  it("accepts with the correct token", async () => {
    const { orgId, inviteeCookies, invitationId, token } = await setupPendingInvitation()

    const res = await agent()
      .post(`/api/invitations/${invitationId}/accept`)
      .set("Cookie", inviteeCookies)
      .send({ token })

    expect(res.status).toBe(201)
    expect(res.body.message).toBe("OK")
    expect(res.body.data).toBeNull()

    const row = await prisma.invitation.findUnique({ where: { id: invitationId } })
    expect(row?.status).toBe("accepted")

    // Membership was actually granted (the member role carries org:read).
    const readOrg = await agent().get(`/api/orgs/${orgId}`).set("Cookie", inviteeCookies)
    expect(readOrg.status).toBe(200)
  })
})
