import { z } from "zod"
import { queryInt } from "@shared/validation/fields"
import { paginationQuerySchema } from "./pagination.dto"

// Default 50 (not the todos 10): member/invitation tables render whole-list UIs
// in the SPA, which sends no query params — page 1 must hold a typical tenant.
export const listQuerySchema = paginationQuerySchema.extend({ limit: queryInt(50, 100) })

export type ListQueryDto = z.infer<typeof listQuerySchema>
