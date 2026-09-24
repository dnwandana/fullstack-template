import { z } from "zod"
import { uuid } from "@shared/validation/fields"

export const updateMemberSchema = z.strictObject({ role_id: uuid }).meta({ id: "UpdateMemberDto" })

export type UpdateMemberDto = z.infer<typeof updateMemberSchema>
