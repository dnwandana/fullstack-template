import { z } from "zod"
import { paginationQuerySchema } from "@shared/pagination/pagination.dto"
import { TODO_SORTABLE } from "../todo-sort"

// Inherits the pagination limit default of 10 — deliberately not ListQueryDto's 50.
export const listTodosSchema = paginationQuerySchema.extend({
  sort_by: z.enum(TODO_SORTABLE).optional(),
})

export type ListTodosDto = z.infer<typeof listTodosSchema>
