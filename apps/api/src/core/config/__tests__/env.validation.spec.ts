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

  it("treats an empty variable as unset", () => {
    expect(validate({ ...base, PORT: "" }).PORT).toBe(3000)
    expect(() => validate({ ...base, DATABASE_URL: "" })).toThrow(/DATABASE_URL: is required/)
  })

  it("keeps variables the schema does not declare", () => {
    expect(validate({ ...base, HOME: "/home/node" }).HOME).toBe("/home/node")
  })

  it("rejects a URL with the wrong scheme", () => {
    expect(() => validate({ ...base, DATABASE_URL: "mysql://u:p@localhost/db" })).toThrow(
      /DATABASE_URL/,
    )
    expect(() => validate({ ...base, REDIS_URL: "http://localhost:6379" })).toThrow(/REDIS_URL/)
    expect(validate({ ...base, REDIS_URL: "rediss://cache.example.com:6380" }).REDIS_URL).toBe(
      "rediss://cache.example.com:6380",
    )
  })

  it("defaults SWAGGER_ENABLED from NODE_ENV and keeps an explicit value", () => {
    expect(validate({ ...base }).SWAGGER_ENABLED).toBe("true")
    expect(validate({ ...base, NODE_ENV: "production" }).SWAGGER_ENABLED).toBe("false")
    expect(
      validate({ ...base, NODE_ENV: "production", SWAGGER_ENABLED: "true" }).SWAGGER_ENABLED,
    ).toBe("true")
  })

  it("reports every offending variable in one error", () => {
    const { JWT_ISSUER: _JWT_ISSUER, ...rest } = base
    const run = () => validate({ ...rest, PORT: "0", LOG_LEVEL: "trace" })
    expect(run).toThrow(/^ {2}- JWT_ISSUER: is required$/m)
    expect(run).toThrow(/^ {2}- PORT: /m)
    expect(run).toThrow(/^ {2}- LOG_LEVEL: /m)
  })

  describe("AUDIT_RETENTION_DAYS", () => {
    it("defaults to 90", () => {
      const value = validate({ ...base })
      expect(value.AUDIT_RETENTION_DAYS).toBe(90)
    })

    it("rejects zero and negatives", () => {
      expect(() => validate({ ...base, AUDIT_RETENTION_DAYS: "0" })).toThrow(/AUDIT_RETENTION_DAYS/)
      expect(() => validate({ ...base, AUDIT_RETENTION_DAYS: "-5" })).toThrow(
        /AUDIT_RETENTION_DAYS/,
      )
    })
  })
})
