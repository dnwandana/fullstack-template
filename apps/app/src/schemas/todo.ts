import { z } from "zod"

export const todoFormSchema = z.object({
  title: z.string().min(1, "Please enter a title").max(255, "Title cannot exceed 255 characters"),
  description: z.string(),
  is_completed: z.boolean(),
})
export type TodoFormValues = z.infer<typeof todoFormSchema>
