import { z } from "zod"
import {
  email,
  newPasswordFields,
  plainSingleLine,
  withPasswordConfirmation,
} from "@shared/validation/fields"

export const signupSchema = withPasswordConfirmation(
  z.strictObject({ name: plainSingleLine(100), email, ...newPasswordFields }),
).meta({ id: "SignupDto" })

export type SignupDto = z.infer<typeof signupSchema>
