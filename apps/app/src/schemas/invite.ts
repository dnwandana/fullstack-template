import { z } from "zod"

export const inviteFormSchema = z.object({
  email: z
    .string()
    .min(1, "Please enter an email address")
    .email("Please enter a valid email address"),
  role_id: z.string().min(1, "Please select a role"),
})
export type InviteFormValues = z.infer<typeof inviteFormSchema>
