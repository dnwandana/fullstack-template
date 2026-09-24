import { z } from "zod"
import { hexToken } from "@shared/validation/fields"

export const acceptInvitationSchema = z
  .strictObject({ token: hexToken })
  .meta({ id: "AcceptInvitationDto" })

export type AcceptInvitationDto = z.infer<typeof acceptInvitationSchema>
