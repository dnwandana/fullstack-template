import { formatIssues } from "@shared/validation/schema-validation.pipe"
import { signupSchema } from "../signup.dto"

// Boundary helper for the 8–128 policy (Argon2 has no 72-byte limit; the old
// 72 cap was a bcrypt artifact). "Aa1!" satisfies the complexity rules so
// only length is under test.
const passphrase = (length: number) => "Aa1!" + "a".repeat(length - 4)

function errorsFor(payload: Record<string, unknown>): string[] {
  const result = signupSchema.safeParse(payload)
  return result.success ? [] : formatIssues(result.error.issues)
}

describe("signupSchema", () => {
  const valid = {
    name: "Ada",
    email: "ADA@X.IO",
    password: "Str0ng!pass",
    confirmation_password: "Str0ng!pass",
  }

  it("accepts a valid payload and lowercases the email", () => {
    const result = signupSchema.safeParse(valid)
    expect(result.success).toBe(true)
    expect(result.data?.email).toBe("ada@x.io")
  })

  it("rejects a weak password", () => {
    const msgs = errorsFor({ ...valid, password: "weak", confirmation_password: "weak" })
    expect(msgs.join(" ")).toMatch(/uppercase|digit|special|8 characters/)
  })

  it("rejects a mismatched confirmation", () => {
    const msgs = errorsFor({ ...valid, confirmation_password: "Different1!" })
    expect(msgs).toEqual(["confirmation_password must match password"])
  })

  it("rejects an unknown key", () => {
    expect(errorsFor({ ...valid, role: "owner" })).toEqual(['Unrecognized key: "role"'])
  })

  it("accepts a 128-char passphrase", () => {
    const password = passphrase(128)
    expect(
      errorsFor({
        name: "n",
        email: "long@example.com",
        password,
        confirmation_password: password,
      }),
    ).toEqual([])
  })

  it("rejects a 129-char password", () => {
    const password = passphrase(129)
    const msgs = errorsFor({
      name: "n",
      email: "long@example.com",
      password,
      confirmation_password: password,
    })
    expect(msgs.join(" ")).toMatch(/at most 128 characters/)
  })
})
