import { CookieService } from "../src/auth/cookie.service"
import { ConfigService } from "@nestjs/config"

function fakeRes() {
  const calls: Array<{ name: string; value: string; opts: Record<string, unknown> }> = []
  return {
    calls,
    cookie(name: string, value: string, opts: Record<string, unknown>) {
      calls.push({ name, value, opts })
    },
  }
}

// A keyed stub, not `() => "development"`: CookieService now reads the token lifetimes
// through the same ConfigService, and parseDuration would throw on "development".
function stubConfig(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService
}

const DEV_DEFAULTS = {
  NODE_ENV: "development",
  ACCESS_TOKEN_EXPIRES_IN: "15m",
  REFRESH_TOKEN_EXPIRES_IN: "7d",
}

// Unusual lifetimes no env file sets — proves the values are derived, not hardcoded.
const UNUSUAL_LIFETIMES = {
  NODE_ENV: "test",
  ACCESS_TOKEN_EXPIRES_IN: "1h",
  REFRESH_TOKEN_EXPIRES_IN: "30d",
}

describe("CookieService", () => {
  const svc = new CookieService(stubConfig(DEV_DEFAULTS))

  it("sets access_token on /api for 15m, httpOnly, strict, insecure in dev", () => {
    const res = fakeRes()
    svc.setAccess(res as never, "a")
    expect(res.calls[0]).toEqual({
      name: "access_token",
      value: "a",
      opts: { httpOnly: true, secure: false, sameSite: "strict", path: "/api", maxAge: 900000 },
    })
  })

  it("sets refresh_token on /api/auth for 7d", () => {
    const res = fakeRes()
    svc.setRefresh(res as never, "r")
    expect(res.calls[0].opts).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      path: "/api/auth",
      maxAge: 604800000,
    })
  })

  it("clears both cookies with maxAge 0 on their paths", () => {
    const res = fakeRes()
    svc.clear(res as never)
    expect(res.calls.map((c) => [c.name, c.opts.path, c.opts.maxAge])).toEqual([
      ["access_token", "/api", 0],
      ["refresh_token", "/api/auth", 0],
    ])
  })

  it("derives maxAge from the configured token lifetimes", () => {
    const cookies = new CookieService(stubConfig(UNUSUAL_LIFETIMES))
    const res = fakeRes()

    cookies.setAccess(res as never, "tok")
    cookies.setRefresh(res as never, "tok")

    expect(res.calls[0].opts.maxAge).toBe(3_600_000)
    expect(res.calls[1].opts.maxAge).toBe(30 * 86_400_000)
  })

  it("still clears cookies with maxAge 0", () => {
    const cookies = new CookieService(stubConfig(UNUSUAL_LIFETIMES))
    const res = fakeRes()

    cookies.clear(res as never)

    expect(res.calls[0].opts.maxAge).toBe(0)
    expect(res.calls[1].opts.maxAge).toBe(0)
  })
})
