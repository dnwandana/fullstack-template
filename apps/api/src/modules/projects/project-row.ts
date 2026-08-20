import { Prisma } from "@prisma/client"

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
} satisfies Prisma.ProjectSelect

/** What `PROJECT_SELECT` returns — the input side of `toProjectResponse`. */
export type ProjectRow = Prisma.ProjectGetPayload<{ select: typeof PROJECT_SELECT }>
