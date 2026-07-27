/**
 * Prisma projection for an invitation row; key order mirrors the response, which `toSnakeKeys`
 * preserves. Not shared with roles.service.ts's own select on purpose — one projection across two
 * features couples their response contracts, so widening it for one silently widens the other.
 */
export const INVITE_SELECT = {
  id: true,
  orgId: true,
  projectId: true,
  inviterId: true,
  inviteeEmail: true,
  inviteeId: true,
  roleId: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} as const

/** Hand-written mirror of `INVITE_SELECT`; nothing derives one from the other, so edit both. */
export type InviteRow = {
  id: string
  orgId: string
  projectId: string | null
  inviterId: string
  inviteeEmail: string | null
  inviteeId: string | null
  roleId: string
  status: string
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}
