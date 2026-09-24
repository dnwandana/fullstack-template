import { z } from "zod"
import { email, uuid } from "@shared/validation/fields"

export const createInvitationSchema = z
  .strictObject({ email, role_id: uuid })
  .meta({ id: "CreateInvitationDto" })

export type CreateInvitationDto = z.infer<typeof createInvitationSchema>
