import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { useAuthStore } from "@/stores/auth"

// stores/auth.test.ts is protected and does not cover logout() at all, so this
// is a separate file rather than an edit to it.

vi.mock("ant-design-vue", () => ({
  message: { success: vi.fn(), error: vi.fn() },
}))

// Simulates the failure mode logout() has to survive: stores/tenant.ts is
// imported dynamically at call time (see auth.ts's comment on the auth <->
// tenant <-> router cycle this avoids), so a chunk fetch failure after a
// redeploy — or any other error inside the tenant store's own clear() — must
// not leave the user "logged in" client-side against cookies the server just
// invalidated.
vi.mock("@/stores/tenant", () => ({
  useTenantStore: () => {
    throw new Error("chunk load failed")
  },
}))

describe("auth store logout resilience (finding 4)", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
    // logout()'s best-effort API call goes through raw fetch, not the mocked
    // @/utils/http client — stub it so the test exercises only the failure
    // path under test instead of a real network call.
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network unavailable"))
  })

  it("clears local session state even when the tenant store fails to load", async () => {
    const store = useAuthStore()
    store.user = { id: "u1", name: "Ada", email: "ada@example.com" }

    await store.logout()

    expect(store.user).toBeNull()
  })

  it("does not reject, so the caller's post-logout navigation still runs", async () => {
    const store = useAuthStore()
    store.user = { id: "u1", name: "Ada", email: "ada@example.com" }

    await expect(store.logout()).resolves.toBeUndefined()
  })
})
