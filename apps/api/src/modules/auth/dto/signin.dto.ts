import { z } from "zod"
import { email } from "@shared/validation/fields"

// Length bounds only: the complexity rules apply when a password is set, not when it is checked.
export const signinSchema = z
  .strictObject({ email, password: z.string().min(8).max(128) })
  .meta({ id: "SigninDto" })

export type SigninDto = z.infer<typeof signinSchema>
