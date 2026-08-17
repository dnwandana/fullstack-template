import { BadRequestException } from "@nestjs/common"
import { RolesService } from "../roles.service"
import type { PrismaService } from "@core/database/prisma.service"
import type { AuditService } from "@core/audit/audit.service"
import type { RoleRow } from "../role-row"

const makeRoleRow = (overrides: Partial<RoleRow> = {}): RoleRow => ({
  id: "role-1",
  orgId: "org-1",
  name: "Auditor",
  description: null,
  isSystem: false,
  createdAt: new Date("2026-08-15T00:00:00Z"),
  updatedAt: new Date("2026-08-15T00:00:00Z"),
  ...overrides,
})

const makePermission = (id: string) => ({
  id,
  name: `perm:${id}`,
  resource: "perm",
  action: id,
  description: null,
})

const makeTx = () => ({
  $queryRaw: jest.fn(),
  role: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
  rolePermission: { createMany: jest.fn(), deleteMany: jest.fn() },
  orgMember: { count: jest.fn() },
  projectMember: { count: jest.fn() },
})

const makePrisma = (tx: ReturnType<typeof makeTx>) => ({
  permission: { count: jest.fn(), findMany: jest.fn() },
  role: { findFirst: jest.fn() },
  $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
})

describe("RolesService audit capture", () => {
  let tx: ReturnType<typeof makeTx>
  let prisma: ReturnType<typeof makePrisma>
  let audit: { record: jest.Mock }
  let service: RolesService

  beforeEach(() => {
    tx = makeTx()
    prisma = makePrisma(tx)
    audit = { record: jest.fn().mockResolvedValue(undefined) }
    service = new RolesService(prisma as unknown as PrismaService, audit as unknown as AuditService)
  })

  it("records role.created", async () => {
    prisma.permission.count.mockResolvedValue(0)
    tx.role.create.mockResolvedValue(makeRoleRow())
    prisma.permission.findMany.mockResolvedValue([])
    await service.create("org-1", "user-1", { name: "Auditor", permission_ids: [] })
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "role.created",
        entityType: "role",
        orgId: "org-1",
        actorId: "user-1",
        entityName: "Auditor",
      }),
    )
  })

  it("records role.updated with a permission_ids diff", async () => {
    prisma.role.findFirst.mockResolvedValue({
      id: "role-1",
      isSystem: false,
      name: "Auditor",
      description: null,
      rolePermissions: [{ permissionId: "p1" }],
    })
    prisma.permission.count.mockResolvedValue(2)
    tx.role.update.mockResolvedValue(makeRoleRow())
    prisma.permission.findMany.mockResolvedValue([makePermission("p1"), makePermission("p2")])
    await service.update("org-1", "user-1", "role-1", { permission_ids: ["p1", "p2"] })
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "role.updated",
        entityType: "role",
        entityId: "role-1",
        changes: expect.objectContaining({
          permission_ids: { from: ["p1"], to: ["p1", "p2"] },
        }),
      }),
    )
  })

  it("records role.deleted", async () => {
    tx.role.findFirst.mockResolvedValue({ id: "role-1", isSystem: false, name: "Auditor" })
    tx.orgMember.count.mockResolvedValue(0)
    tx.projectMember.count.mockResolvedValue(0)
    await service.remove("org-1", "user-1", "role-1")
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "role.deleted", entityId: "role-1" }),
    )
  })

  it("records nothing when the delete fails because the role is in use", async () => {
    tx.role.findFirst.mockResolvedValue({ id: "role-1", isSystem: false, name: "Auditor" })
    tx.orgMember.count.mockResolvedValue(1)
    tx.projectMember.count.mockResolvedValue(0)
    await expect(service.remove("org-1", "user-1", "role-1")).rejects.toThrow(BadRequestException)
    expect(audit.record).not.toHaveBeenCalled()
  })
})
