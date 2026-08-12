import { CookieService } from "../cookie.service"
import { ConfigService } from "@nestjs/config"
import { ACCESS_COOKIE_PATH, REFRESH_COOKIE_PATH } from "@core/config/api-version"

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

  it("sets access_token on /api/v1 for 15m, httpOnly, strict, insecure in dev", () => {
    const res = fakeRes()
    svc.setAccess(res as never, "a")
    expect(res.calls[0]).toEqual({
      name: "access_token",
      value: "a",
      opts: { httpOnly: true, secure: false, sameSite: "strict", path: "/api/v1", maxAge: 900000 },
    })
  })

  it("sets refresh_token on /api/v1/auth for 7d", () => {
    const res = fakeRes()
    svc.setRefresh(res as never, "r")
    const first = res.calls[0]
    if (!first) throw new Error("expected setRefresh to have written a cookie")
    expect(first.opts).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      path: "/api/v1/auth",
      maxAge: 604800000,
    })
  })

  it("clears both cookies with maxAge 0 on their paths", () => {
    const res = fakeRes()
    svc.clear(res as never)
    expect(res.calls.map((c) => [c.name, c.opts.path, c.opts.maxAge])).toEqual([
      ["access_token", "/api/v1", 0],
      ["refresh_token", "/api/v1/auth", 0],
    ])
  })

  it("derives maxAge from the configured token lifetimes", () => {
    const cookies = new CookieService(stubConfig(UNUSUAL_LIFETIMES))
    const res = fakeRes()

    cookies.setAccess(res as never, "tok")
    cookies.setRefresh(res as never, "tok")

    const [access, refresh] = res.calls
    if (!access || !refresh) throw new Error("expected one cookie each from setAccess/setRefresh")
    expect(access.opts.maxAge).toBe(3_600_000)
    expect(refresh.opts.maxAge).toBe(30 * 86_400_000)
  })

  it("still clears cookies with maxAge 0", () => {
    const cookies = new CookieService(stubConfig(UNUSUAL_LIFETIMES))
    const res = fakeRes()

    cookies.clear(res as never)

    const [access, refresh] = res.calls
    if (!access || !refresh) throw new Error("expected clear() to have written both cookies")
    expect(access.opts.maxAge).toBe(0)
    expect(refresh.opts.maxAge).toBe(0)
  })

  describe("cookie paths under URI versioning", () => {
    it("scopes the access cookie to the versioned prefix", () => {
      const res = fakeRes()
      svc.setAccess(res as never, "tok")
      const first = res.calls[0]
      if (!first) throw new Error("expected setAccess to have written a cookie")
      expect(first.name).toBe("access_token")
      expect(first.opts.path).toBe("/api/v1")
    })

    it("scopes the refresh cookie to the versioned auth path", () => {
      const res = fakeRes()
      svc.setRefresh(res as never, "tok")
      const first = res.calls[0]
      if (!first) throw new Error("expected setRefresh to have written a cookie")
      expect(first.name).toBe("refresh_token")
      // "/api/auth" would NOT cover "/api/v1/auth/refresh": cookie paths match by whole
      // segments, and "v1" is not "auth".
      expect(first.opts.path).toBe("/api/v1/auth")
    })

    // The one that matters most: a cookie cleared on a different path than it was set on
    // is not cleared at all — the browser keeps the original and the user stays logged in
    // after logout. Asserted against the shared constants so the two cannot drift.
    it("clears both cookies on the same paths it set them", () => {
      const res = fakeRes()
      svc.clear(res as never)
      const [access, refresh] = res.calls
      if (!access || !refresh) throw new Error("expected clear() to have written both cookies")
      expect([access.name, access.opts.path]).toEqual(["access_token", ACCESS_COOKIE_PATH])
      expect([refresh.name, refresh.opts.path]).toEqual(["refresh_token", REFRESH_COOKIE_PATH])
    })
  })
})
