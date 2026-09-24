import { z } from "zod"
import { optionalDescription, plainSingleLine } from "@shared/validation/fields"

export const todoBodySchema = z
  .strictObject({
    title: plainSingleLine(255),
    description: optionalDescription,
    is_completed: z.boolean().optional(),
  })
  .meta({ id: "TodoBodyDto" })

export type TodoBodyDto = z.infer<typeof todoBodySchema>
