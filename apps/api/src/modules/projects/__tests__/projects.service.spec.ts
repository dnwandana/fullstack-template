import { ProjectsService } from "../projects.service"
import type { PrismaService } from "@core/database/prisma.service"
import type { AuditService } from "@core/audit/audit.service"

const projectRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "proj-1",
  orgId: "org-1",
  name: "Apollo",
  description: null,
  createdBy: "user-1",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
})

const makePrisma = () => {
  const tx = {
    project: { create: jest.fn() },
    orgMember: { findUnique: jest.fn() },
    projectMember: { create: jest.fn() },
  }
  const prisma = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    project: {
      findUnique: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  }
  return { prisma, tx }
}

describe("ProjectsService audit capture", () => {
  let prisma: ReturnType<typeof makePrisma>["prisma"]
  let tx: ReturnType<typeof makePrisma>["tx"]
  let audit: { record: jest.Mock }
  let service: ProjectsService

  beforeEach(() => {
    ;({ prisma, tx } = makePrisma())
    audit = { record: jest.fn() }
    service = new ProjectsService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    )
  })

  it("records project.created with projectId set to the new project", async () => {
    tx.project.create.mockResolvedValue(projectRow())
    tx.orgMember.findUnique.mockResolvedValue({ roleId: "role-1" })

    await service.create("org-1", "user-1", { name: "Apollo" })

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "project.created",
        entityType: "project",
        orgId: "org-1",
        actorId: "user-1",
        entityName: "Apollo",
        projectId: expect.any(String),
      }),
    )
    const txOrder = prisma.$transaction.mock.invocationCallOrder[0]
    const recordOrder = audit.record.mock.invocationCallOrder[0]
    expect(recordOrder).toBeGreaterThan(txOrder ?? Infinity)
  })

  it("records project.updated with a diff", async () => {
    prisma.project.findUnique.mockResolvedValue({
      orgId: "org-1",
      name: "Old",
      description: null,
    })
    prisma.project.update.mockResolvedValue(projectRow({ name: "New" }))

    await service.update("proj-1", "user-1", { name: "New" })

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "project.updated",
        changes: expect.objectContaining({ name: { from: "Old", to: "New" } }),
      }),
    )
  })

  it("records project.deleted after the delete", async () => {
    prisma.project.findUnique.mockResolvedValue({ orgId: "org-1", name: "Apollo" })
    prisma.project.deleteMany.mockResolvedValue({ count: 1 })

    await service.remove("proj-1", "user-1")

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "project.deleted", projectId: "proj-1" }),
    )
    const deleteOrder = prisma.project.deleteMany.mock.invocationCallOrder[0]
    const recordOrder = audit.record.mock.invocationCallOrder[0]
    expect(recordOrder).toBeGreaterThan(deleteOrder ?? Infinity)
  })

  it("skips the project.deleted entry when the project does not exist", async () => {
    prisma.project.findUnique.mockResolvedValue(null)
    prisma.project.deleteMany.mockResolvedValue({ count: 0 })

    await service.remove("proj-1", "user-1")

    expect(audit.record).not.toHaveBeenCalled()
    expect(prisma.project.deleteMany).toHaveBeenCalledWith({ where: { id: "proj-1" } })
  })
})
