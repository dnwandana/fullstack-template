import { z } from "zod"

export const orgFormSchema = z.object({
  name: z
    .string()
    .min(1, "Please enter an organization name")
    .max(100, "Name cannot exceed 100 characters"),
  description: z.string(),
})
export type OrgFormValues = z.infer<typeof orgFormSchema>

// OrgSettingsView and ProjectSettingsView share one rule set.
export const settingsFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string(),
})
export type SettingsFormValues = z.infer<typeof settingsFormSchema>
