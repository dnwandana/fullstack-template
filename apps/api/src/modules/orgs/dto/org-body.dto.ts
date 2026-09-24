import { z } from "zod"
import { optionalDescription, plainSingleLine } from "@shared/validation/fields"

export const orgBodySchema = z
  .strictObject({ name: plainSingleLine(100), description: optionalDescription })
  .meta({ id: "OrgBodyDto" })

export type OrgBodyDto = z.infer<typeof orgBodySchema>
