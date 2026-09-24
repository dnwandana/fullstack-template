import { z } from "zod"
import { hexToken, newPasswordFields, withPasswordConfirmation } from "@shared/validation/fields"

// Shares the signup password policy: a reset that accepts a weaker password than signup would
// bypass that policy.
export const resetPasswordSchema = withPasswordConfirmation(
  z.strictObject({ token: hexToken, ...newPasswordFields }),
).meta({ id: "ResetPasswordDto" })

export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>
