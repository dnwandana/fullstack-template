import { Prisma } from "@prisma/client"

/**
 * The Prisma selection and the row type it produces, kept together so a change to one is
 * visibly a change to the other: `toTodoResponse` maps this to the wire contract, so drifting
 * them apart stops that mapper compiling instead of changing the public API.
 */
export const TODO_SELECT = {
  id: true,
  projectId: true,
  userId: true,
  title: true,
  description: true,
  isCompleted: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TodoSelect

/** What `TODO_SELECT` returns — the input side of `toTodoResponse`. */
export type TodoRow = Prisma.TodoGetPayload<{ select: typeof TODO_SELECT }>
