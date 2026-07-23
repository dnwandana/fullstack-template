import { validate } from "class-validator"
import { plainToInstance } from "class-transformer"
import { SignupDto } from "../src/auth/dto/signup.dto"

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
})
