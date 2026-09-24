import { z } from "zod"
import { email } from "@shared/validation/fields"

export const forgotPasswordSchema = z.strictObject({ email }).meta({ id: "ForgotPasswordDto" })

export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>
