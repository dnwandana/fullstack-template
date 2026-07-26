import { Test } from "@nestjs/testing"
import { INestApplication } from "@nestjs/common"
import request from "supertest"
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/bootstrap"
import { PrismaService } from "../src/prisma/prisma.service"
import { truncateAll, seedPermissions } from "./setup-e2e"
import { signupAndSignin, createOrg, getRoleId } from "./factory"

describe("Invitations (e2e)", () => {
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

  it("creates an org invitation, surfaces it to the invitee, and accepts it", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const memberRoleId = await getRoleId(prisma, org.id, "member")

    const created = await agent()
      .post(`/api/orgs/${org.id}/invitations`)
      .set("Cookie", owner.cookies)
      .send({ email: "invitee@x.io", role_id: memberRoleId })
    expect(created.status).toBe(201)
    expect(created.body.data.invitee_email).toBe("invitee@x.io")
    const invitationId = created.body.data.id as string

    // Owner can list org invitations.
    const orgList = await agent()
      .get(`/api/orgs/${org.id}/invitations`)
      .set("Cookie", owner.cookies)
    expect(orgList.status).toBe(200)
    expect(orgList.body.data).toHaveLength(1)

    // Invitee signs up (backfill links invitee_id) and sees the pending invite.
    const invitee = await signupAndSignin(app, { email: "invitee@x.io" })
    const mine = await agent().get(`/api/invitations`).set("Cookie", invitee.cookies)
    expect(mine.status).toBe(200)
    expect(mine.body.data).toHaveLength(1)
    expect(mine.body.data[0].id).toBe(invitationId)

    // Invitee accepts — the raw token from create is required, then ownership is checked.
    const accept = await agent()
      .post(`/api/invitations/${invitationId}/accept`)
      .set("Cookie", invitee.cookies)
      .send({ token: created.body.data.token })
    expect(accept.status).toBe(201)

    // The invitee is now an org member (member role grants org:read).
    const readOrg = await agent().get(`/api/orgs/${org.id}`).set("Cookie", invitee.cookies)
    expect(readOrg.status).toBe(200)

    // Accepting again fails — no longer pending. Accept does not rotate token_hash,
    // so the same token still matches and the status branch is what rejects this.
    const again = await agent()
      .post(`/api/invitations/${invitationId}/accept`)
      .set("Cookie", invitee.cookies)
      .send({ token: created.body.data.token })
    expect(again.status).toBe(400)
    expect(again.body.message).toBe("Invitation is no longer pending")
  })

  it("rejects acceptance by a user the invitation does not belong to", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const memberRoleId = await getRoleId(prisma, org.id, "member")

    const created = await agent()
      .post(`/api/orgs/${org.id}/invitations`)
      .set("Cookie", owner.cookies)
      .send({ email: "invitee@x.io", role_id: memberRoleId })
    const invitationId = created.body.data.id as string

    const stranger = await signupAndSignin(app, { email: "stranger@x.io" })
    // A valid token gets past the token check, so the 403 comes from the ownership check.
    const accept = await agent()
      .post(`/api/invitations/${invitationId}/accept`)
      .set("Cookie", stranger.cookies)
      .send({ token: created.body.data.token })
    expect(accept.status).toBe(403)
    expect(accept.body.message).toBe("This invitation does not belong to you")
  })

  it("lets the invitee decline an invitation", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const memberRoleId = await getRoleId(prisma, org.id, "member")

    const created = await agent()
      .post(`/api/orgs/${org.id}/invitations`)
      .set("Cookie", owner.cookies)
      .send({ email: "invitee@x.io", role_id: memberRoleId })
    const invitationId = created.body.data.id as string

    const invitee = await signupAndSignin(app, { email: "invitee@x.io" })
    const decline = await agent()
      .post(`/api/invitations/${invitationId}/decline`)
      .set("Cookie", invitee.cookies)
    expect(decline.status).toBe(201)

    const mine = await agent().get(`/api/invitations`).set("Cookie", invitee.cookies)
    expect(mine.body.data).toHaveLength(0)
  })

  it("guards the public preview endpoint by token shape and existence", async () => {
    const badShape = await agent().get(
      `/api/invitations/11111111-1111-1111-1111-111111111111/preview?token=nothex`,
    )
    expect(badShape.status).toBe(400)

    const wrongToken = await agent().get(
      `/api/invitations/11111111-1111-1111-1111-111111111111/preview?token=${"a".repeat(64)}`,
    )
    expect(wrongToken.status).toBe(404)
  })

  it("rejects an invitation whose role belongs to another organization", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const foreignOwner = await signupAndSignin(app)
    const foreignOrg = await createOrg(app, foreignOwner.cookies, "Foreign")
    const foreignRoleId = await getRoleId(prisma, foreignOrg.id, "owner")

    const res = await agent()
      .post(`/api/orgs/${org.id}/invitations`)
      .set("Cookie", owner.cookies)
      .send({ email: "victim@x.io", role_id: foreignRoleId })
    expect(res.status).toBe(404)
    expect(await prisma.invitation.count()).toBe(0)
  })

  it("returns 400 for a non-UUID invitation id on the public preview", async () => {
    const res = await agent().get(`/api/invitations/not-a-uuid/preview?token=${"a".repeat(64)}`)
    expect(res.status).toBe(400)
  })

  it("returns the raw token and accept_url on create and resend", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const memberRoleId = await getRoleId(prisma, org.id, "member")
    const created = await agent()
      .post(`/api/orgs/${org.id}/invitations`)
      .set("Cookie", owner.cookies)
      .send({ email: "invitee@x.io", role_id: memberRoleId })
    expect(created.body.data.token).toMatch(/^[0-9a-f]{64}$/)
    expect(created.body.data.accept_url).toContain(
      `/invite/${created.body.data.id}?token=${created.body.data.token}`,
    )

    const resend = await agent()
      .post(`/api/orgs/${org.id}/invitations/${created.body.data.id}/resend`)
      .set("Cookie", owner.cookies)
    expect(resend.body.data.token).toMatch(/^[0-9a-f]{64}$/)
    expect(resend.body.data.token).not.toBe(created.body.data.token)
    expect(resend.body.data.accept_url).toContain(`?token=${resend.body.data.token}`)
  })

  it("rejects a duplicate pending invitation for the same email and scope", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const memberRoleId = await getRoleId(prisma, org.id, "member")
    const first = await agent()
      .post(`/api/orgs/${org.id}/invitations`)
      .set("Cookie", owner.cookies)
      .send({ email: "invitee@x.io", role_id: memberRoleId })
    expect(first.status).toBe(201)
    const second = await agent()
      .post(`/api/orgs/${org.id}/invitations`)
      .set("Cookie", owner.cookies)
      .send({ email: "invitee@x.io", role_id: memberRoleId })
    expect(second.status).toBe(400)
  })

  it("returns 400 when accepting while already an org member", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const memberRoleId = await getRoleId(prisma, org.id, "member")
    const first = await agent()
      .post(`/api/orgs/${org.id}/invitations`)
      .set("Cookie", owner.cookies)
      .send({ email: "invitee@x.io", role_id: memberRoleId })
    const invitee = await signupAndSignin(app, { email: "invitee@x.io" })
    const firstAccept = await agent()
      .post(`/api/invitations/${first.body.data.id}/accept`)
      .set("Cookie", invitee.cookies)
      .send({ token: first.body.data.token })
    expect(firstAccept.status).toBe(201)

    // The first invitation is consumed, so a second one is legal to create…
    const second = await agent()
      .post(`/api/orgs/${org.id}/invitations`)
      .set("Cookie", owner.cookies)
      .send({ email: "invitee@x.io", role_id: memberRoleId })
    expect(second.status).toBe(201)
    // …but accepting it while already a member is a 400, not a 500.
    const res = await agent()
      .post(`/api/invitations/${second.body.data.id}/accept`)
      .set("Cookie", invitee.cookies)
      .send({ token: second.body.data.token })
    expect(res.status).toBe(400)
    expect(res.body.message).toBe("You are already a member of this organization")
  })

  it("rejects resending an invitation that is no longer pending", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const memberRoleId = await getRoleId(prisma, org.id, "member")
    const created = await agent()
      .post(`/api/orgs/${org.id}/invitations`)
      .set("Cookie", owner.cookies)
      .send({ email: "invitee@x.io", role_id: memberRoleId })
    const invitee = await signupAndSignin(app, { email: "invitee@x.io" })
    const accept = await agent()
      .post(`/api/invitations/${created.body.data.id}/accept`)
      .set("Cookie", invitee.cookies)
      .send({ token: created.body.data.token })
    expect(accept.status).toBe(201)

    const resend = await agent()
      .post(`/api/orgs/${org.id}/invitations/${created.body.data.id}/resend`)
      .set("Cookie", owner.cookies)
    expect(resend.status).toBe(400)
  })

  it("enriches invitation reads with related names", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const memberRoleId = await getRoleId(prisma, org.id, "member")
    const created = await agent()
      .post(`/api/orgs/${org.id}/invitations`)
      .set("Cookie", owner.cookies)
      .send({ email: "invitee@x.io", role_id: memberRoleId })

    const orgList = await agent()
      .get(`/api/orgs/${org.id}/invitations`)
      .set("Cookie", owner.cookies)
    expect(orgList.body.data[0].role_name).toBe("member")
    expect(orgList.body.data[0].inviter_name).toBeDefined()

    const invitee = await signupAndSignin(app, { email: "invitee@x.io" })
    const mine = await agent().get(`/api/invitations`).set("Cookie", invitee.cookies)
    expect(mine.body.data[0]).toMatchObject({ org_name: "Acme", role_name: "member" })
    expect(mine.body.data[0].inviter_name).toBeDefined()

    const preview = await agent().get(
      `/api/invitations/${created.body.data.id}/preview?token=${created.body.data.token}`,
    )
    expect(preview.status).toBe(200)
    expect(preview.body.data).toMatchObject({
      org_name: "Acme",
      role_name: "member",
      invitee_email: "invitee@x.io",
      is_expired: false,
      requires_signup: false,
    })
  })

  it("does not backfill declined invitations at signup", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const memberRoleId = await getRoleId(prisma, org.id, "member")
    const created = await agent()
      .post(`/api/orgs/${org.id}/invitations`)
      .set("Cookie", owner.cookies)
      .send({ email: "declined@x.io", role_id: memberRoleId })
    await prisma.invitation.update({
      where: { id: created.body.data.id },
      data: { status: "declined" },
    })

    await signupAndSignin(app, { email: "declined@x.io" })
    const row = await prisma.invitation.findUnique({ where: { id: created.body.data.id } })
    expect(row?.inviteeId).toBeNull()
  })

  it("requires the invitations:create permission to invite", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const memberRoleId = await getRoleId(prisma, org.id, "member")

    // A member (no invitations:create) cannot invite.
    const created = await agent()
      .post(`/api/orgs/${org.id}/invitations`)
      .set("Cookie", owner.cookies)
      .send({ email: "member@x.io", role_id: memberRoleId })
    const invitationId = created.body.data.id as string
    const member = await signupAndSignin(app, { email: "member@x.io" })
    // The accept must succeed, otherwise the 403 below would come from OrgGuard
    // (non-member) rather than from PermissionsGuard, which is what this test names.
    const accepted = await agent()
      .post(`/api/invitations/${invitationId}/accept`)
      .set("Cookie", member.cookies)
      .send({ token: created.body.data.token })
    expect(accepted.status).toBe(201)

    const forbidden = await agent()
      .post(`/api/orgs/${org.id}/invitations`)
      .set("Cookie", member.cookies)
      .send({ email: "another@x.io", role_id: memberRoleId })
    expect(forbidden.status).toBe(403)
  })
})
