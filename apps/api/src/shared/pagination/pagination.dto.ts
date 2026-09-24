import { z } from "zod"
import { queryInt } from "@shared/validation/fields"

// No `.meta({ id })` on a query schema: with an id, Swagger emits no query parameters.
export const paginationQuerySchema = z.strictObject({
  page: queryInt(1),
  limit: queryInt(10, 100),
  sort_by: z.string().optional(),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().max(255).default(""),
})

export type PaginationQueryDto = z.infer<typeof paginationQuerySchema>
