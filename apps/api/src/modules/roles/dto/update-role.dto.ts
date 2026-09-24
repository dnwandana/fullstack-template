import { z } from "zod"
import { roleFields } from "./create-role.dto"

export const updateRoleSchema = z.strictObject(roleFields).partial().meta({ id: "UpdateRoleDto" })

export type UpdateRoleDto = z.infer<typeof updateRoleSchema>
