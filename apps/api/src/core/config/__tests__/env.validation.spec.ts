import { validate } from "../env.validation"

const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  ACCESS_TOKEN_SECRET: "a".repeat(40),
  REFRESH_TOKEN_SECRET: "b".repeat(40),
  JWT_ISSUER: "https://api.example.com",
  JWT_AUDIENCE: "https://api.example.com",
  REDIS_URL: "redis://localhost:6379",
}

describe("validate(env)", () => {
  it("applies defaults for optional vars", () => {
    const out = validate({ ...base })
    expect(out.PORT).toBe(3000)
    expect(out.NODE_ENV).toBe("development")
    expect(out.RATE_LIMIT_GENERAL_MAX).toBe(1000)
    expect(out.CLEANUP_ENABLED).toBe("true")
  })

  it("rejects a non-numeric general rate limit", () => {
    expect(() => validate({ ...base, RATE_LIMIT_GENERAL_MAX: "abc" })).toThrow(
      /RATE_LIMIT_GENERAL_MAX/,
    )
  })

  it("throws when a required var is missing", () => {
    const { DATABASE_URL: _DATABASE_URL, ...rest } = base
    expect(() => validate(rest)).toThrow(/DATABASE_URL/)
  })

  it("throws when access and refresh secrets are equal", () => {
    expect(() => validate({ ...base, REFRESH_TOKEN_SECRET: "a".repeat(40) })).toThrow(/different/)
  })

  it("rejects a token lifetime that is not <number><s|m|h|d>", () => {
    expect(() => validate({ ...base, ACCESS_TOKEN_EXPIRES_IN: "1w" })).toThrow(
      /ACCESS_TOKEN_EXPIRES_IN/,
    )
    expect(() => validate({ ...base, REFRESH_TOKEN_EXPIRES_IN: "7days" })).toThrow(
      /REFRESH_TOKEN_EXPIRES_IN/,
    )
  })

  it("throws on a changeme placeholder secret", () => {
    expect(() => validate({ ...base, ACCESS_TOKEN_SECRET: "changeme_" + "x".repeat(32) })).toThrow(
      /placeholder/,
    )
  })
})
