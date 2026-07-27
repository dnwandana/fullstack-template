/**
 * The Prisma selection and the row type it produces, kept together so a change to one is
 * visibly a change to the other: `toProjectResponse` maps this to the wire contract, so
 * drifting them apart stops that mapper compiling instead of changing the public API.
 */
export const PROJECT_SELECT = {
  id: true,
  orgId: true,
  name: true,
  description: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} as const

/** What `PROJECT_SELECT` returns — the input side of `toProjectResponse`. */
export type ProjectRow = {
  id: string
  orgId: string
  name: string
  description: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}
