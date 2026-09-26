import { z } from "zod"

const email = z
  .string()
  .min(1, "Please enter your email")
  .email("Please enter a valid email address")
  .max(255, "Email must be at most 255 characters")

const password = z
  .string()
  .min(1, "Please enter your password")
  .min(8, "Password must be at least 8 characters")

export const loginSchema = z.object({ email, password })
export type LoginValues = z.infer<typeof loginSchema>

export const signupSchema = z
  .object({
    name: z
      .string()
      .max(100, "Name must be at most 100 characters")
      .refine((v) => v.trim().length > 0, "Please enter your name"),
    email,
    password,
    confirmation_password: z.string().min(1, "Please confirm your password"),
  })
  .refine((v) => v.password === v.confirmation_password, {
    message: "Passwords do not match",
    path: ["confirmation_password"],
  })
export type SignupValues = z.infer<typeof signupSchema>
