import { OrgsService } from "../orgs.service"
import { SYSTEM_ROLE_PERMISSIONS } from "../system-roles"
import type { PrismaService } from "@core/database/prisma.service"
import type { AuditService } from "@core/audit/audit.service"

const orgRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "org-1",
  name: "Acme",
  description: null,
  createdBy: "user-1",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
})

const makePrisma = () => {
  const tx = {
    organization: { create: jest.fn() },
    permission: { findMany: jest.fn() },
    role: { create: jest.fn() },
    rolePermission: { createMany: jest.fn() },
    orgMember: { create: jest.fn() },
  }
  const prisma = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    organization: {
      findUnique: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  }
  return { prisma, tx }
}

describe("OrgsService audit capture", () => {
  let prisma: ReturnType<typeof makePrisma>["prisma"]
  let tx: ReturnType<typeof makePrisma>["tx"]
  let audit: { record: jest.Mock }
  let service: OrgsService

  beforeEach(() => {
    ;({ prisma, tx } = makePrisma())
    audit = { record: jest.fn() }
    service = new OrgsService(prisma as unknown as PrismaService, audit as unknown as AuditService)
  })

  it("records org.created after the transaction commits", async () => {
    tx.organization.create.mockResolvedValue(orgRow())
    tx.permission.findMany.mockResolvedValue(
      SYSTEM_ROLE_PERMISSIONS.owner.map((name) => ({ id: `perm-${name}`, name })),
    )
    tx.role.create.mockResolvedValue({ id: "role-1" })

    await service.createWithSystemRoles("user-1", { name: "Acme" })

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "org.created",
        entityType: "org",
        actorId: "user-1",
        entityName: "Acme",
      }),
    )
    const txOrder = prisma.$transaction.mock.invocationCallOrder[0]
    const recordOrder = audit.record.mock.invocationCallOrder[0]
    expect(recordOrder).toBeGreaterThan(txOrder ?? Infinity)
  })

  it("records org.updated with a diff", async () => {
    prisma.organization.findUnique.mockResolvedValue(orgRow({ name: "Old" }))
    prisma.organization.update.mockResolvedValue(orgRow({ name: "New" }))

    await service.update("org-1", "user-1", { name: "New" })

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "org.updated",
        changes: expect.objectContaining({ name: { from: "Old", to: "New" } }),
      }),
    )
  })

  it("records org.deleted before the delete", async () => {
    prisma.organization.findUnique.mockResolvedValue(orgRow())
    prisma.organization.deleteMany.mockResolvedValue({ count: 1 })

    await service.remove("org-1", "user-1")

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "org.deleted", entityType: "org" }),
    )
    const recordOrder = audit.record.mock.invocationCallOrder[0]
    const deleteOrder = prisma.organization.deleteMany.mock.invocationCallOrder[0]
    expect(recordOrder).toBeLessThan(deleteOrder ?? -Infinity)
  })

  it("skips the org.deleted entry when the org does not exist", async () => {
    prisma.organization.findUnique.mockResolvedValue(null)
    prisma.organization.deleteMany.mockResolvedValue({ count: 0 })

    await service.remove("org-1", "user-1")

    expect(audit.record).not.toHaveBeenCalled()
    expect(prisma.organization.deleteMany).toHaveBeenCalledWith({ where: { id: "org-1" } })
  })
})
