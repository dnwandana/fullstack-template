import { Test } from "@nestjs/testing"
import { BadRequestException, INestApplication } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import request from "supertest"
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/bootstrap"
import { PrismaService } from "../src/prisma/prisma.service"
import { RolesService } from "../src/roles/roles.service"
import { truncateAll, seedPermissions } from "./setup-e2e"
import { signupAndSignin, createOrg, getRoleId } from "./factory"
import { randomUUID } from "crypto"

describe("Roles (e2e)", () => {
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

  it("creates a custom role, lists it, and blocks editing a system role", async () => {
    const { cookies } = await signupAndSignin(app)
    const org = await createOrg(app, cookies)
    const perm = await prisma.permission.findFirstOrThrow({ where: { name: "todos:read" } })

    const created = await agent()
      .post(`/api/orgs/${org.id}/roles`)
      .set("Cookie", cookies)
      .send({ name: "Auditor", description: "read only", permission_ids: [perm.id] })
    expect(created.status).toBe(201)

    const list = await agent().get(`/api/orgs/${org.id}/roles`).set("Cookie", cookies)
    expect(list.status).toBe(200)
    expect(list.body.data.some((r: { name: string }) => r.name === "Auditor")).toBe(true)

    const ownerRole = await prisma.role.findFirstOrThrow({
      where: { orgId: org.id, name: "owner" },
    })
    const blocked = await agent()
      .put(`/api/orgs/${org.id}/roles/${ownerRole.id}`)
      .set("Cookie", cookies)
      .send({ name: "Overlord" })
    expect(blocked.status).toBe(400)
  })

  it("returns 400 when creating a role whose name already exists", async () => {
    const { cookies } = await signupAndSignin(app)
    const org = await createOrg(app, cookies)
    const perm = await prisma.permission.findFirstOrThrow({ where: { name: "todos:read" } })
    const res = await agent()
      .post(`/api/orgs/${org.id}/roles`)
      .set("Cookie", cookies)
      .send({ name: "admin", permission_ids: [perm.id] })
    expect(res.status).toBe(400)
  })

  it("returns 400 when creating a role with unknown permission ids", async () => {
    const { cookies } = await signupAndSignin(app)
    const org = await createOrg(app, cookies)
    const res = await agent()
      .post(`/api/orgs/${org.id}/roles`)
      .set("Cookie", cookies)
      .send({ name: "Ghost", permission_ids: [randomUUID()] })
    expect(res.status).toBe(400)
  })

  it("rejects a malformed role id with 400", async () => {
    const { cookies } = await signupAndSignin(app)
    const org = await createOrg(app, cookies)
    const res = await agent()
      .put(`/api/orgs/${org.id}/roles/not-a-uuid`)
      .set("Cookie", cookies)
      .send({ name: "X" })
    expect(res.status).toBe(400)
  })

  it("reads a single role with its permissions", async () => {
    const { cookies } = await signupAndSignin(app)
    const org = await createOrg(app, cookies)
    const perm = await prisma.permission.findFirstOrThrow({ where: { name: "todos:read" } })
    const created = await agent()
      .post(`/api/orgs/${org.id}/roles`)
      .set("Cookie", cookies)
      .send({ name: "Auditor", permission_ids: [perm.id] })

    const res = await agent()
      .get(`/api/orgs/${org.id}/roles/${created.body.data.id}`)
      .set("Cookie", cookies)
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ name: "Auditor", is_system: false })
    expect(res.body.data.permissions.some((p: { name: string }) => p.name === "todos:read")).toBe(
      true,
    )

    const missing = await agent()
      .get(`/api/orgs/${org.id}/roles/11111111-1111-1111-1111-111111111111`)
      .set("Cookie", cookies)
    expect(missing.status).toBe(404)
  })

  it("blocks deleting a role that is in use", async () => {
    const { cookies } = await signupAndSignin(app)
    const org = await createOrg(app, cookies)
    const perm = await prisma.permission.findFirstOrThrow({ where: { name: "todos:read" } })
    const created = await agent()
      .post(`/api/orgs/${org.id}/roles`)
      .set("Cookie", cookies)
      .send({ name: "Temp", permission_ids: [perm.id] })
    const other = await signupAndSignin(app)
    await prisma.orgMember.create({
      data: { orgId: org.id, userId: other.userId, roleId: created.body.data.id },
    })
    const res = await agent()
      .delete(`/api/orgs/${org.id}/roles/${created.body.data.id}`)
      .set("Cookie", cookies)
    expect(res.status).toBe(400)
  })

  it("returns 400 when deleting a role used only by a project member", async () => {
    const owner = await signupAndSignin(app)
    const org = await createOrg(app, owner.cookies)
    const invitee = await signupAndSignin(app)
    const perm = await prisma.permission.findFirstOrThrow({ where: { name: "todos:read" } })

    const created = await agent()
      .post(`/api/orgs/${org.id}/roles`)
      .set("Cookie", owner.cookies)
      .send({
        name: "project-only",
        description: "held via project membership only",
        permission_ids: [perm.id],
      })
    expect(created.status).toBe(201)
    const roleId = created.body.data.id as string

    const project = await agent()
      .post(`/api/orgs/${org.id}/projects`)
      .set("Cookie", owner.cookies)
      .send({ name: "P1" })
    expect(project.status).toBe(201)
    const projectId = project.body.data.id as string

    // Attach the role through project_members only — no org_members row uses it.
    await prisma.orgMember.create({
      data: {
        orgId: org.id,
        userId: invitee.userId,
        roleId: await getRoleId(prisma, org.id, "viewer"),
      },
    })
    await prisma.projectMember.create({ data: { projectId, userId: invitee.userId, roleId } })

    const res = await agent()
      .delete(`/api/orgs/${org.id}/roles/${roleId}`)
      .set("Cookie", owner.cookies)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Cannot delete a role that is in use")
    expect(res.body.data).toBeNull()
  })

  // The RESTRICT FKs only fire for callers that skip the advisory lock, which the
  // HTTP surface never does — so drive the service with a Prisma stub that throws
  // the rejection the database would raise. P2003 is the raw Postgres 23503; P2014
  // is the same condition when Prisma reports it as a required-relation violation.
  it.each(["P2003", "P2014"])("maps a %s foreign-key rejection to the same 400", async (code) => {
    const fkError = new Prisma.PrismaClientKnownRequestError("FK violation", {
      code,
      clientVersion: Prisma.prismaVersion.client,
    })
    const service = new RolesService({
      $transaction: async () => {
        throw fkError
      },
    } as unknown as PrismaService)

    const err = await service.remove(randomUUID(), randomUUID()).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(BadRequestException)
    expect((err as BadRequestException).getStatus()).toBe(400)
    expect((err as BadRequestException).message).toBe("Cannot delete a role that is in use")
  })

  it("rethrows a non-foreign-key Prisma error from remove untouched", async () => {
    const other = new Prisma.PrismaClientKnownRequestError("nope", {
      code: "P2025",
      clientVersion: Prisma.prismaVersion.client,
    })
    const service = new RolesService({
      $transaction: async () => {
        throw other
      },
    } as unknown as PrismaService)

    const err = await service.remove(randomUUID(), randomUUID()).catch((e: unknown) => e)
    expect(err).toBe(other)
  })

  it("deletes an unused custom role but blocks deleting a system role", async () => {
    const { cookies } = await signupAndSignin(app)
    const org = await createOrg(app, cookies)
    const perm = await prisma.permission.findFirstOrThrow({ where: { name: "todos:read" } })
    const created = await agent()
      .post(`/api/orgs/${org.id}/roles`)
      .set("Cookie", cookies)
      .send({ name: "Temp", permission_ids: [perm.id] })
    expect(
      (
        await agent()
          .delete(`/api/orgs/${org.id}/roles/${created.body.data.id}`)
          .set("Cookie", cookies)
      ).status,
    ).toBe(200)

    const memberRole = await prisma.role.findFirstOrThrow({
      where: { orgId: org.id, name: "member" },
    })
    expect(
      (await agent().delete(`/api/orgs/${org.id}/roles/${memberRole.id}`).set("Cookie", cookies))
        .status,
    ).toBe(400)
  })
})
