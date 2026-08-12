import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

vi.mock("../storage", () => ({ clearUserData: vi.fn() }))
vi.mock("ant-design-vue", () => ({ message: { error: vi.fn(), success: vi.fn() } }))

import { request } from "../http"

/** Minimal stand-in for the parts of fetch's Response that http.ts reads. */
function res(status: number, body: unknown = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

const fetchMock = vi.fn()

// http.ts hard-redirects via `window.location.href = "/login"` when a token
// refresh fails. Replace window.location with a plain object so we can observe
// the assignment without jsdom attempting a real navigation.
const realLocation = window.location

function setLocation(pathname: string): void {
  Object.defineProperty(window, "location", {
    value: { pathname, href: `http://localhost:8080${pathname}` },
    writable: true,
    configurable: true,
  })
}

function restoreLocation(): void {
  Object.defineProperty(window, "location", {
    value: realLocation,
    writable: true,
    configurable: true,
  })
}

describe("http.ts hard-redirect on failed refresh", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    restoreLocation()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("does NOT hard-redirect when a data 401 + failed refresh happens while already on /login", async () => {
    // The reload-loop guard: reloading to /login from /login is what turns a
    // single failed refresh into an infinite loop.
    setLocation("/login")
    fetchMock
      .mockResolvedValueOnce(res(401)) // GET /orgs
      .mockResolvedValueOnce(res(401)) // POST /auth/refresh

    await expect(request.get("/orgs")).rejects.toBeDefined()

    expect(window.location.href).toBe("http://localhost:8080/login") // unchanged — no reload
  })

  it("still hard-redirects to /login when the session dies on an app route", async () => {
    // Preserve the legitimate session-expiry UX: a background 401 whose refresh
    // fails while the user is actually using the app should send them to login.
    setLocation("/orgs")
    fetchMock
      .mockResolvedValueOnce(res(401)) // GET /orgs
      .mockResolvedValueOnce(res(401)) // POST /auth/refresh

    await expect(request.get("/orgs")).rejects.toBeDefined()

    expect(window.location.href).toBe("/login") // redirected
  })
})
