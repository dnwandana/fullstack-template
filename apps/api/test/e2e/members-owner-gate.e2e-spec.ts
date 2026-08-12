import { randomUUID } from "crypto"
import { Test } from "@nestjs/testing"
import { INestApplication } from "@nestjs/common"
import request from "supertest"
import { AppModule } from "../../src/app.module"
import { createTestApp } from "../create-test-app"
import { PrismaService } from "@core/database/prisma.service"
import { truncateAll, seedPermissions } from "../setup-e2e"
import { signupAndSignin, createOrg, getRoleId } from "../factory"

describe("Owner-role gate (e2e)", () => {
  let app: INestApplication
  let prisma: PrismaService
  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = await createTestApp(ref)
    prisma = app.get(PrismaService)
  })
  beforeEach(async () => {
    await truncateAll(prisma)
    await seedPermissions(prisma)
  })
  afterAll(async () => app.close())
  const agent = () => request(app.getHttpServer())

  // Owner-created custom role carrying permissions the admin role lacks.
  const createCustomRole = async (orgId: string, name: string, permissionNames: string[]) => {
    const id = randomUUID()
    await prisma.role.create({
      data: {
        id,
        orgId,
        name,
        rolePermissions: {
          create: permissionNames.map((n) => ({ permission: { connect: { name: n } } })),
        },
      },
    })
    return id
  }

  it("blocks an admin from granting, demoting or removing the owner role", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const admin = await signupAndSignin(app)
    const member = await signupAndSignin(app)
    const secondOwner = await signupAndSignin(app)
    const ownerRoleId = await getRoleId(prisma, org.id, "owner")
    const adminRoleId = await getRoleId(prisma, org.id, "admin")
    const memberRoleId = await getRoleId(prisma, org.id, "member")
    await prisma.orgMember.createMany({
      data: [
        { orgId: org.id, userId: admin.userId, roleId: adminRoleId },
        { orgId: org.id, userId: member.userId, roleId: memberRoleId },
        { orgId: org.id, userId: secondOwner.userId, roleId: ownerRoleId },
      ],
    })

    const promote = await agent()
      .put(`/api/v1/orgs/${org.id}/members/${member.userId}`)
      .set("Cookie", admin.cookies)
      .send({ role_id: ownerRoleId })
    expect(promote.status).toBe(403)
    expect(promote.body.message).toMatch(/Only owners/)

    const demote = await agent()
      .put(`/api/v1/orgs/${org.id}/members/${secondOwner.userId}`)
      .set("Cookie", admin.cookies)
      .send({ role_id: adminRoleId })
    expect(demote.status).toBe(403)

    const remove = await agent()
      .delete(`/api/v1/orgs/${org.id}/members/${secondOwner.userId}`)
      .set("Cookie", admin.cookies)
    expect(remove.status).toBe(403)
  })

  it("lets an owner grant the owner role", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const member = await signupAndSignin(app)
    const ownerRoleId = await getRoleId(prisma, org.id, "owner")
    const memberRoleId = await getRoleId(prisma, org.id, "member")
    await prisma.orgMember.create({
      data: { orgId: org.id, userId: member.userId, roleId: memberRoleId },
    })
    const res = await agent()
      .put(`/api/v1/orgs/${org.id}/members/${member.userId}`)
      .set("Cookie", owner.cookies)
      .send({ role_id: ownerRoleId })
    expect(res.status).toBe(200)
  })

  it("blocks granting a role whose permissions the actor does not hold", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const admin = await signupAndSignin(app)
    const member = await signupAndSignin(app)
    const adminRoleId = await getRoleId(prisma, org.id, "admin")
    const memberRoleId = await getRoleId(prisma, org.id, "member")
    await prisma.orgMember.createMany({
      data: [
        { orgId: org.id, userId: admin.userId, roleId: adminRoleId },
        { orgId: org.id, userId: member.userId, roleId: memberRoleId },
      ],
    })
    // Admin deliberately lacks org:delete — granting this role would escalate.
    const superRoleId = await createCustomRole(org.id, "superrole", ["org:read", "org:delete"])

    const res = await agent()
      .put(`/api/v1/orgs/${org.id}/members/${member.userId}`)
      .set("Cookie", admin.cookies)
      .send({ role_id: superRoleId })
    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/do not hold/)
  })

  it("blocks granting a role with unheld permissions at project scope", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const proj = await agent()
      .post(`/api/v1/orgs/${org.id}/projects`)
      .set("Cookie", owner.cookies)
      .send({ name: "P" })
    const projectId = proj.body.data.id as string

    const admin = await signupAndSignin(app)
    const target = await signupAndSignin(app)
    const adminRoleId = await getRoleId(prisma, org.id, "admin")
    const memberRoleId = await getRoleId(prisma, org.id, "member")
    await prisma.orgMember.createMany({
      data: [
        { orgId: org.id, userId: admin.userId, roleId: adminRoleId },
        { orgId: org.id, userId: target.userId, roleId: memberRoleId },
      ],
    })
    await prisma.projectMember.create({
      data: { projectId, userId: target.userId, roleId: memberRoleId },
    })
    // Admin deliberately lacks org:manage_roles.
    const sneakyRoleId = await createCustomRole(org.id, "sneaky", ["org:manage_roles"])

    const res = await agent()
      .put(`/api/v1/orgs/${org.id}/projects/${projectId}/members/${target.userId}`)
      .set("Cookie", admin.cookies)
      .send({ role_id: sneakyRoleId })
    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/do not hold/)
  })

  it("still lets an admin change and remove non-owner members", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const admin = await signupAndSignin(app)
    const member = await signupAndSignin(app)
    const adminRoleId = await getRoleId(prisma, org.id, "admin")
    const memberRoleId = await getRoleId(prisma, org.id, "member")
    const viewerRoleId = await getRoleId(prisma, org.id, "viewer")
    await prisma.orgMember.createMany({
      data: [
        { orgId: org.id, userId: admin.userId, roleId: adminRoleId },
        { orgId: org.id, userId: member.userId, roleId: memberRoleId },
      ],
    })

    const change = await agent()
      .put(`/api/v1/orgs/${org.id}/members/${member.userId}`)
      .set("Cookie", admin.cookies)
      .send({ role_id: viewerRoleId })
    expect(change.status).toBe(200)

    const remove = await agent()
      .delete(`/api/v1/orgs/${org.id}/members/${member.userId}`)
      .set("Cookie", admin.cookies)
    expect(remove.status).toBe(200)
  })

  it("rejects assigning the owner role at project scope", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const proj = await agent()
      .post(`/api/v1/orgs/${org.id}/projects`)
      .set("Cookie", owner.cookies)
      .send({ name: "P" })
    const projectId = proj.body.data.id as string

    const other = await signupAndSignin(app)
    const ownerRoleId = await getRoleId(prisma, org.id, "owner")
    const memberRoleId = await getRoleId(prisma, org.id, "member")
    await prisma.orgMember.create({
      data: { orgId: org.id, userId: other.userId, roleId: memberRoleId },
    })
    await prisma.projectMember.create({
      data: { projectId, userId: other.userId, roleId: memberRoleId },
    })

    const res = await agent()
      .put(`/api/v1/orgs/${org.id}/projects/${projectId}/members/${other.userId}`)
      .set("Cookie", owner.cookies)
      .send({ role_id: ownerRoleId })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/project scope/)
  })
})
