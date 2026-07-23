import { validate } from "../src/config/env.validation"

const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  ACCESS_TOKEN_SECRET: "a".repeat(40),
  REFRESH_TOKEN_SECRET: "b".repeat(40),
  JWT_ISSUER: "https://api.example.com",
  JWT_AUDIENCE: "https://api.example.com",
}

describe("validate(env)", () => {
  it("applies defaults for optional vars", () => {
    const out = validate({ ...base })
    expect(out.PORT).toBe(3000)
    expect(out.NODE_ENV).toBe("development")
    expect(out.RATE_LIMIT_GENERAL_MAX).toBe(100)
  })

  it("throws when a required var is missing", () => {
    const { DATABASE_URL: _DATABASE_URL, ...rest } = base
    expect(() => validate(rest)).toThrow(/DATABASE_URL/)
  })

  it("throws when access and refresh secrets are equal", () => {
    expect(() => validate({ ...base, REFRESH_TOKEN_SECRET: "a".repeat(40) })).toThrow(/different/)
  })

  it("throws on a changeme placeholder secret", () => {
    expect(() => validate({ ...base, ACCESS_TOKEN_SECRET: "changeme_" + "x".repeat(32) })).toThrow(
      /placeholder/,
    )
  })
})
