import { validate } from "class-validator"
import { plainToInstance } from "class-transformer"
import { SignupDto } from "../src/auth/dto/signup.dto"

// Boundary helper for the 8–128 policy (Argon2 has no 72-byte limit; the old
// 72 cap was a bcrypt artifact). "Aa1!" satisfies the complexity rules so
// only length is under test.
const passphrase = (length: number) => "Aa1!" + "a".repeat(length - 4)

async function errorsFor(payload: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(SignupDto, payload)
  const errors = await validate(dto)
  return errors.flatMap((e) => Object.values(e.constraints ?? {}))
}

describe("SignupDto", () => {
  const valid = {
    name: "Ada",
    email: "ADA@X.IO",
    password: "Str0ng!pass",
    confirmation_password: "Str0ng!pass",
  }

  it("accepts a valid payload and lowercases the email", async () => {
    const dto = plainToInstance(SignupDto, valid)
    expect(await validate(dto)).toHaveLength(0)
    expect(dto.email).toBe("ada@x.io")
  })

  it("rejects a weak password", async () => {
    const msgs = await errorsFor({ ...valid, password: "weak", confirmation_password: "weak" })
    expect(msgs.join(" ")).toMatch(/uppercase|digit|special|8 characters/)
  })

  it("rejects a mismatched confirmation", async () => {
    const msgs = await errorsFor({ ...valid, confirmation_password: "Different1!" })
    expect(msgs.join(" ")).toMatch(/confirmation_password must match password/)
  })

  it("accepts a 128-char passphrase", async () => {
    const dto = plainToInstance(SignupDto, {
      name: "n",
      email: "long@example.com",
      password: passphrase(128),
      confirmation_password: passphrase(128),
    })
    expect(await validate(dto)).toHaveLength(0)
  })

  it("rejects a 129-char password", async () => {
    const msgs = await errorsFor({
      name: "n",
      email: "long@example.com",
      password: passphrase(129),
      confirmation_password: passphrase(129),
    })
    expect(msgs.join(" ")).toMatch(/at most 128 characters/)
  })
})
