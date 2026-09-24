import { z } from "zod"
import { optionalDescription, plainSingleLine, uuid } from "@shared/validation/fields"

// Shared with UpdateRoleDto. The `.meta({ id })` stays off this object, because a derived
// schema does not inherit it.
export const roleFields = {
  name: plainSingleLine(50),
  description: optionalDescription,
  permission_ids: z.array(uuid).min(1),
}

export const createRoleSchema = z.strictObject(roleFields).meta({ id: "CreateRoleDto" })

export type CreateRoleDto = z.infer<typeof createRoleSchema>
