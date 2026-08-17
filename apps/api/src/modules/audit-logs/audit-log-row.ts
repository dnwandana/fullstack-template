import { Prisma } from "@prisma/client"

/**
 * The Prisma selection and the row type it produces, kept together so a change to one is
 * visibly a change to the other: `toAuditLogResponse` maps this row to the wire contract,
 * so a drift between the two stops that mapper from compiling.
 */
export const AUDIT_LOG_SELECT = {
  id: true,
  orgId: true,
  projectId: true,
  actorId: true,
  actorName: true,
  actorEmail: true,
  action: true,
  entityType: true,
  entityId: true,
  entityName: true,
  changes: true,
  createdAt: true,
} satisfies Prisma.AuditLogSelect

/** What `AUDIT_LOG_SELECT` returns — the input side of `toAuditLogResponse`. */
export type AuditLogRow = Prisma.AuditLogGetPayload<{ select: typeof AUDIT_LOG_SELECT }>
