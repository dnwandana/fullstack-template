// The Prisma selection and the row type it produces, kept together so a change to
// one is visibly a change to the other. `toProjectResponse` maps this to the wire
// contract; if these drift apart, that mapper stops compiling — which is the
// entire point of declaring the response type separately.
export const PROJECT_SELECT = {
  id: true,
  orgId: true,
  name: true,
  description: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} as const

export type ProjectRow = {
  id: string
  orgId: string
  name: string
  description: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}
