import { NotFoundException } from "@nestjs/common"
import { MembersService } from "../members.service"
import type { PrismaService } from "@core/database/prisma.service"
import type { PaginationService } from "@shared/pagination/pagination.service"
import type { AuditService } from "@core/audit/audit.service"

// The $transaction mock runs the callback against this tx object, so the same
// model mocks serve the transactional and the non-transactional paths.
const makeTx = () => ({
  $queryRaw: jest.fn().mockResolvedValue([]),
  role: { findFirst: jest.fn() },
  orgMember: {
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
})

const makePrisma = (tx: ReturnType<typeof makeTx>) => ({
  $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
  role: { findFirst: jest.fn() },
  projectMember: {
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
})

const makeAudit = () => ({ record: jest.fn().mockResolvedValue(undefined) })

const makeService = () => {
  const tx = makeTx()
  const prisma = makePrisma(tx)
  const audit = makeAudit()
  const service = new MembersService(
    prisma as unknown as PrismaService,
    {} as PaginationService,
    audit as unknown as AuditService,
  )
  return { service, tx, prisma, audit }
}

const orgTarget = { role: { name: "Member" }, user: { name: "Ada" } }

const updatedOrgRow = {
  userId: "target-1",
  orgId: "org-1",
  roleId: "role-admin",
  joinedAt: new Date("2026-01-01"),
  user: { name: "Ada", email: "ada@example.com" },
  role: { name: "Admin" },
}

describe("MembersService audit capture", () => {
  it("records member.role_changed with role names in changes", async () => {
    const { service, tx, audit } = makeService()
    tx.role.findFirst.mockResolvedValue({ name: "Admin", rolePermissions: [] })
    tx.orgMember.findUnique.mockResolvedValue(orgTarget)
    tx.orgMember.update.mockResolvedValue(updatedOrgRow)

    await service.updateOrgMemberRole("org-1", "acting-1", "target-1", "role-admin", [])

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "member.role_changed",
        entityType: "member",
        entityId: "target-1",
        entityName: "Ada",
        actorId: "acting-1",
        changes: { role: { from: "Member", to: "Admin" } },
      }),
    )
  })

  it("records nothing when the role-change transaction throws", async () => {
    const { service, tx, audit } = makeService()
    tx.role.findFirst.mockResolvedValue({ name: "Admin", rolePermissions: [] })
    tx.orgMember.findUnique.mockResolvedValue(null)

    await expect(
      service.updateOrgMemberRole("org-1", "acting-1", "target-1", "role-admin", []),
    ).rejects.toThrow(NotFoundException)
    expect(audit.record).not.toHaveBeenCalled()
  })

  it("records member.removed for an org member", async () => {
    const { service, tx, audit } = makeService()
    tx.orgMember.findUnique.mockResolvedValue(orgTarget)
    tx.orgMember.delete.mockResolvedValue({})

    await service.removeOrgMember("org-1", "acting-1", "target-1")

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "member.removed",
        entityType: "member",
        entityId: "target-1",
        entityName: "Ada",
        actorId: "acting-1",
      }),
    )
    expect(audit.record).toHaveBeenCalledWith(
      expect.not.objectContaining({ changes: expect.anything() }),
    )
  })

  it("records member.role_changed with projectId for a project member", async () => {
    const { service, prisma, audit } = makeService()
    prisma.role.findFirst.mockResolvedValue({ name: "Admin", rolePermissions: [] })
    prisma.projectMember.findUnique.mockResolvedValue({
      userId: "target-1",
      role: { name: "Member" },
      user: { name: "Ada" },
    })
    prisma.projectMember.update.mockResolvedValue({
      userId: "target-1",
      projectId: "proj-1",
      roleId: "role-admin",
      joinedAt: new Date("2026-01-01"),
      user: { name: "Ada", email: "ada@example.com" },
      role: { name: "Admin" },
    })

    await service.updateProjectMemberRole("org-1", "proj-1", "acting-1", "target-1", "role-admin", [])

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "member.role_changed",
        projectId: "proj-1",
        entityId: "target-1",
        entityName: "Ada",
        actorId: "acting-1",
        changes: { role: { from: "Member", to: "Admin" } },
      }),
    )
  })

  it("records member.removed with projectId for a project member", async () => {
    const { service, prisma, audit } = makeService()
    prisma.projectMember.findUnique.mockResolvedValue({
      userId: "target-1",
      user: { name: "Ada" },
    })
    prisma.projectMember.delete.mockResolvedValue({})

    await service.removeProjectMember("org-1", "proj-1", "acting-1", "target-1")

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "member.removed",
        projectId: "proj-1",
        entityId: "target-1",
        entityName: "Ada",
        actorId: "acting-1",
      }),
    )
  })
})
