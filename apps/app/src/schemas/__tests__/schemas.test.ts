import { loginSchema, signupSchema } from "@/schemas/auth"
import { orgFormSchema, settingsFormSchema } from "@/schemas/org"
import { projectFormSchema } from "@/schemas/project"
import { todoFormSchema } from "@/schemas/todo"
import { roleFormSchema } from "@/schemas/role"
import { inviteFormSchema } from "@/schemas/invite"

function firstMessage(result: {
  success: boolean
  error?: { issues: { message: string }[] }
}) {
  return result.success ? undefined : result.error?.issues[0]?.message
}

describe("auth schemas", () => {
  it("requires email and password on login", () => {
    expect(firstMessage(loginSchema.safeParse({ email: "", password: "x" }))).toBe(
      "Please enter your email",
    )
    expect(firstMessage(loginSchema.safeParse({ email: "a@b.co", password: "" }))).toBe(
      "Please enter your password",
    )
    expect(firstMessage(loginSchema.safeParse({ email: "nope", password: "x" }))).toBe(
      "Please enter a valid email address",
    )
  })

  it("rejects whitespace names and mismatched passwords on signup", () => {
    const base = { name: "A", email: "a@b.co", password: "12345678", confirmation_password: "12345678" }
    expect(firstMessage(signupSchema.safeParse({ ...base, name: "   " }))).toBe(
      "Please enter your name",
    )
    expect(firstMessage(signupSchema.safeParse({ ...base, name: "a".repeat(101) }))).toBe(
      "Name must be at most 100 characters",
    )
    expect(firstMessage(signupSchema.safeParse({ ...base, password: "1234567", confirmation_password: "1234567" }))).toBe(
      "Password must be at least 8 characters",
    )
    expect(firstMessage(signupSchema.safeParse({ ...base, confirmation_password: "" }))).toBe(
      "Please confirm your password",
    )
    expect(firstMessage(signupSchema.safeParse({ ...base, confirmation_password: "different" }))).toBe(
      "Passwords do not match",
    )
    expect(signupSchema.safeParse(base).success).toBe(true)
  })
})

describe("entity schemas", () => {
  it("validates org and project names", () => {
    expect(firstMessage(orgFormSchema.safeParse({ name: "", description: "" }))).toBe(
      "Please enter an organization name",
    )
    expect(firstMessage(orgFormSchema.safeParse({ name: "a".repeat(101), description: "" }))).toBe(
      "Name cannot exceed 100 characters",
    )
    expect(firstMessage(projectFormSchema.safeParse({ name: "", description: "" }))).toBe(
      "Please enter a project name",
    )
    expect(firstMessage(settingsFormSchema.safeParse({ name: "", description: "" }))).toBe(
      "Name is required",
    )
  })

  it("validates todo, role and invite", () => {
    expect(firstMessage(todoFormSchema.safeParse({ title: "", description: "", is_completed: false }))).toBe(
      "Please enter a title",
    )
    expect(firstMessage(todoFormSchema.safeParse({ title: "a".repeat(256), description: "", is_completed: false }))).toBe(
      "Title cannot exceed 255 characters",
    )
    expect(firstMessage(roleFormSchema.safeParse({ name: "", description: "", permissions: ["p"] }))).toBe(
      "Please enter a role name",
    )
    expect(firstMessage(roleFormSchema.safeParse({ name: "r", description: "", permissions: [] }))).toBe(
      "Please select at least one permission",
    )
    expect(firstMessage(inviteFormSchema.safeParse({ email: "", role_id: "r1" }))).toBe(
      "Please enter an email address",
    )
    expect(firstMessage(inviteFormSchema.safeParse({ email: "a@b.co", role_id: "" }))).toBe(
      "Please select a role",
    )
  })
})
