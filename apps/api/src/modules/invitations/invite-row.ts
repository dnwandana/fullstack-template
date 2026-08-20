import { Prisma } from "@prisma/client"

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
} satisfies Prisma.InvitationSelect

/** What `INVITE_SELECT` returns — the input side of `toInvitationResponse`. */
export type InviteRow = Prisma.InvitationGetPayload<{ select: typeof INVITE_SELECT }>
