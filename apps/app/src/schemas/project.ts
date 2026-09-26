import { z } from "zod"

export const projectFormSchema = z.object({
  name: z
    .string()
    .min(1, "Please enter a project name")
    .max(100, "Name cannot exceed 100 characters"),
  description: z.string(),
})
export type ProjectFormValues = z.infer<typeof projectFormSchema>
