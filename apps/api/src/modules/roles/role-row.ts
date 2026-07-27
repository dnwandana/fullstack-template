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
} as const

/** Shared by the list and detail paths so both emit an identical permission shape. */
export const PERMISSION_SELECT = {
  id: true,
  name: true,
  resource: true,
  action: true,
  description: true,
} as const

/** The row `ROLE_SELECT` produces; `toRoleResponse` adds `permissions` on top. */
export type RoleRow = {
  id: string
  orgId: string
  name: string
  description: string | null
  isSystem: boolean
  createdAt: Date
  updatedAt: Date
}
