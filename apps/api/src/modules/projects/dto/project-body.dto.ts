import { z } from "zod"
import { optionalDescription, plainSingleLine } from "@shared/validation/fields"

export const projectBodySchema = z
  .strictObject({ name: plainSingleLine(100), description: optionalDescription })
  .meta({ id: "ProjectBodyDto" })

export type ProjectBodyDto = z.infer<typeof projectBodySchema>
