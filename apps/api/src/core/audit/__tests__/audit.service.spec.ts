import { AuditService } from "../audit.service"
import type { PrismaService } from "@core/database/prisma.service"

const makePrisma = () => ({
  user: { findUnique: jest.fn() },
  auditLog: { create: jest.fn() },
})

const event = {
  orgId: "org-1",
  actorId: "user-1",
  action: "todo.created" as const,
  entityType: "todo" as const,
  entityId: "todo-1",
  entityName: "Write the spec",
}

describe("AuditService.record", () => {
  it("snapshots the actor and inserts the row", async () => {
    const prisma = makePrisma()
    prisma.user.findUnique.mockResolvedValue({ name: "Ada", email: "ada@example.com" })
    await new AuditService(prisma as unknown as PrismaService).record(event)
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: "org-1",
        actorId: "user-1",
        actorName: "Ada",
        actorEmail: "ada@example.com",
        action: "todo.created",
        entityName: "Write the spec",
      }),
    })
  })

  it('falls back to "Unknown" when the actor row is gone', async () => {
    const prisma = makePrisma()
    prisma.user.findUnique.mockResolvedValue(null)
    await new AuditService(prisma as unknown as PrismaService).record(event)
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorName: "Unknown", actorEmail: null }),
    })
  })

  it("swallows insert failures instead of throwing", async () => {
    const prisma = makePrisma()
    prisma.user.findUnique.mockResolvedValue(null)
    prisma.auditLog.create.mockRejectedValue(new Error("db down"))
    await expect(
      new AuditService(prisma as unknown as PrismaService).record(event),
    ).resolves.toBeUndefined()
  })
})
