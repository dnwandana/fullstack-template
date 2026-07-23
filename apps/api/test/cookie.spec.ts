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

describe("CookieService", () => {
  const svc = new CookieService({ get: () => "development" } as unknown as ConfigService)

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
})
