import { z } from "zod"

export const roleFormSchema = z.object({
  name: z.string().min(1, "Please enter a role name"),
  description: z.string(),
  permissions: z.array(z.string()).min(1, "Please select at least one permission"),
})
export type RoleFormValues = z.infer<typeof roleFormSchema>
