// One projection for every role response — the list endpoint returning fewer
// fields than the detail endpoint was accidental drift (L-27), and description
// is what a role-picker UI renders.
export const ROLE_SELECT = {
  id: true,
  orgId: true,
  name: true,
  description: true,
  isSystem: true,
  createdAt: true,
  updatedAt: true,
} as const

export const PERMISSION_SELECT = {
  id: true,
  name: true,
  resource: true,
  action: true,
  description: true,
} as const

export type RoleRow = {
  id: string
  orgId: string
  name: string
  description: string | null
  isSystem: boolean
  createdAt: Date
  updatedAt: Date
}
