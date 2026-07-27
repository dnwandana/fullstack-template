// Key order mirrors the response shape — Prisma returns columns in select
// order and toSnakeKeys preserves it.
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
