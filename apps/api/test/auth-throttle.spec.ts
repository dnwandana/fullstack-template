import { authThrottleLimit } from "../src/config/auth-throttle"

describe("authThrottleLimit", () => {
  const saved = process.env.RATE_LIMIT_AUTH_MAX
  afterEach(() => {
    if (saved === undefined) delete process.env.RATE_LIMIT_AUTH_MAX
    else process.env.RATE_LIMIT_AUTH_MAX = saved
  })
  it("defaults to 10 when unset", () => {
    delete process.env.RATE_LIMIT_AUTH_MAX
    expect(authThrottleLimit()).toBe(10)
  })
  it("parses a valid value", () => {
    process.env.RATE_LIMIT_AUTH_MAX = "25"
    expect(authThrottleLimit()).toBe(25)
  })
  it.each(["abc", "0", "51", "1.5"])("throws on %s instead of silently defaulting", (v) => {
    process.env.RATE_LIMIT_AUTH_MAX = v
    expect(() => authThrottleLimit()).toThrow(/RATE_LIMIT_AUTH_MAX/)
  })
})
