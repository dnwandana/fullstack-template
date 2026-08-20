import { Prisma } from "@prisma/client"

/**
 * One projection for every role response — list returning fewer fields than detail
 * was accidental drift (L-27), and `description` is what a role-picker UI renders.
 */
export const ROLE_SELECT = {
  id: true,
  orgId: true,
  name: true,
  description: true,
  isSystem: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RoleSelect

/** Shared by the list and detail paths so both emit an identical permission shape. */
export const PERMISSION_SELECT = {
  id: true,
  name: true,
  resource: true,
  action: true,
  description: true,
} satisfies Prisma.PermissionSelect

/** The row `ROLE_SELECT` produces; `toRoleResponse` adds `permissions` on top. */
export type RoleRow = Prisma.RoleGetPayload<{ select: typeof ROLE_SELECT }>
