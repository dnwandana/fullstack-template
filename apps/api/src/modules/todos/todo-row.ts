// The Prisma selection and the row type it produces, kept together so a change to
// one is visibly a change to the other. `toTodoResponse` maps this to the wire
// contract; if these drift apart, that mapper stops compiling — which is the
// entire point of declaring the response type separately.
export const TODO_SELECT = {
  id: true,
  projectId: true,
  userId: true,
  title: true,
  description: true,
  isCompleted: true,
  createdAt: true,
  updatedAt: true,
} as const

export type TodoRow = {
  id: string
  projectId: string
  userId: string
  title: string
  description: string | null
  isCompleted: boolean
  createdAt: Date
  updatedAt: Date
}
