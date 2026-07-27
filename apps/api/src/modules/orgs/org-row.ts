/**
 * Kept beside `OrgRow` so a change to one is visibly a change to the other: if the
 * two drift apart, `toOrgResponse` stops compiling.
 */
export const ORG_SELECT = {
  id: true,
  name: true,
  description: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} as const

/** The row `ORG_SELECT` produces; `OrgResponse` is its snake_case wire form. */
export type OrgRow = {
  id: string
  name: string
  description: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}
