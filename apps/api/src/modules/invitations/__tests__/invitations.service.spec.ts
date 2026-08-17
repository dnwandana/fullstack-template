import { InvitationsService } from "../invitations.service"
import type { PrismaService } from "@core/database/prisma.service"
import type { AuditService } from "@core/audit/audit.service"
import type { InvitationNotifierService } from "../invitation-notifier.service"
import type { ConfigService } from "@nestjs/config"
import type { PaginationService } from "@shared/pagination/pagination.service"

const FUTURE = new Date(Date.now() + 86400000)

const invRow = {
  id: "inv-1",
  orgId: "org-1",
  projectId: null,
  inviterId: "user-1",
  inviteeEmail: "new@example.com",
  inviteeId: null,
  roleId: "role-1",
  status: "pending",
  expiresAt: FUTURE,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
}

// The $transaction mock runs the callback against this tx object, so the same
// model mocks serve the transactional and the non-transactional paths.
const makeTx = () => ({
  $queryRaw: jest.fn().mockResolvedValue([]),
  invitation: {
    create: jest.fn(),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  orgMember: { create: jest.fn(), findUnique: jest.fn() },
  projectMember: { create: jest.fn(), findUnique: jest.fn() },
  role: { findFirstOrThrow: jest.fn() },
})

const makePrisma = (tx: ReturnType<typeof makeTx>) => ({
  $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
  role: { findFirst: jest.fn() },
  user: { findUnique: jest.fn() },
  invitation: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    deleteMany: jest.fn(),
    update: jest.fn(),
  },
})

const makeService = () => {
  const tx = makeTx()
  const prisma = makePrisma(tx)
  const audit = { record: jest.fn().mockResolvedValue(undefined) }
  const notifier = { sendInvitationEmail: jest.fn().mockResolvedValue(undefined) }
  const config = { get: jest.fn().mockReturnValue("http://app.example.com") }
  const service = new InvitationsService(
    prisma as unknown as PrismaService,
    notifier as unknown as InvitationNotifierService,
    config as unknown as ConfigService,
    {} as PaginationService,
    audit as unknown as AuditService,
  )
  return { service, tx, prisma, audit }
}

describe("InvitationsService audit capture", () => {
  it("records invitation.created with the invitee email as entityName", async () => {
    const { service, tx, prisma, audit } = makeService()
    prisma.role.findFirst.mockResolvedValue({ id: "role-1" })
    prisma.invitation.findFirst.mockResolvedValue(null)
    prisma.user.findUnique.mockResolvedValue(null)
    tx.invitation.create.mockResolvedValue(invRow)

    await service.create("org-1", null, "user-1", { email: "new@example.com", role_id: "role-1" }, "Acme")

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "invitation.created",
        entityType: "invitation",
        entityId: "inv-1",
        entityName: "new@example.com",
        actorId: "user-1",
      }),
    )
  })

  it("records invitation.accepted and member.added on accept, in that order", async () => {
    const { service, tx, prisma, audit } = makeService()
    tx.invitation.findFirst.mockResolvedValue({ ...invRow, inviteeId: "user-2" })
    tx.orgMember.findUnique.mockResolvedValue(null)
    prisma.user.findUnique.mockResolvedValue({ name: "Ada" })

    await service.accept("inv-1", "user-2", "new@example.com", "a".repeat(64))

    expect(audit.record).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: "invitation.accepted",
        entityType: "invitation",
        entityId: "inv-1",
        entityName: "new@example.com",
        actorId: "user-2",
      }),
    )
    expect(audit.record).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: "member.added",
        entityType: "member",
        entityId: "user-2",
        entityName: "Ada",
        actorId: "user-2",
      }),
    )
  })

  it("records nothing when accept rolls back", async () => {
    const { service, tx, audit } = makeService()
    tx.invitation.findFirst.mockResolvedValue(null)

    await expect(service.accept("inv-1", "user-2", "new@example.com", "a".repeat(64))).rejects.toThrow(
      "Invitation not found",
    )
    expect(audit.record).not.toHaveBeenCalled()
  })

  it("records invitation.revoked on remove", async () => {
    const { service, prisma, audit } = makeService()
    prisma.invitation.findFirst.mockResolvedValue({ inviteeEmail: "new@example.com" })
    prisma.invitation.deleteMany.mockResolvedValue({ count: 1 })

    await service.remove("org-1", "user-1", "inv-1")

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "invitation.revoked",
        entityType: "invitation",
        entityId: "inv-1",
        entityName: "new@example.com",
        actorId: "user-1",
      }),
    )
  })

  it("records invitation.resent with the resending user as actor", async () => {
    const { service, prisma, audit } = makeService()
    prisma.invitation.findFirst.mockResolvedValue({
      id: "inv-1",
      inviteeEmail: "new@example.com",
      status: "pending",
    })
    prisma.invitation.update.mockResolvedValue(invRow)

    await service.resend("org-1", "user-1", "inv-1", "Acme")

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "invitation.resent",
        entityType: "invitation",
        entityId: "inv-1",
        entityName: "new@example.com",
        actorId: "user-1",
      }),
    )
  })

  it("records invitation.declined with the invitee as actor", async () => {
    const { service, prisma, audit } = makeService()
    prisma.invitation.findUnique.mockResolvedValue({
      id: "inv-1",
      orgId: "org-1",
      inviteeId: "user-2",
      inviteeEmail: "new@example.com",
      status: "pending",
    })
    prisma.invitation.update.mockResolvedValue(invRow)

    await service.decline("inv-1", "user-2", "new@example.com")

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "invitation.declined",
        entityType: "invitation",
        entityId: "inv-1",
        entityName: "new@example.com",
        actorId: "user-2",
      }),
    )
  })

  it('falls back to "unknown" as entityName when the invitee email is null', async () => {
    const { service, prisma, audit } = makeService()
    prisma.invitation.findUnique.mockResolvedValue({
      id: "inv-1",
      orgId: "org-1",
      inviteeId: "user-2",
      inviteeEmail: null,
      status: "pending",
    })
    prisma.invitation.update.mockResolvedValue(invRow)

    await service.decline("inv-1", "user-2", "new@example.com")

    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entityName: "unknown" }))
  })
})
