import { setActivePinia, createPinia } from "pinia"
import { useAuthStore } from "@/stores/auth"
import { getUserData } from "@/utils/storage"
import { request } from "@/utils/http"

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))

vi.mock("ant-design-vue", () => ({
  message: { success: vi.fn(), error: vi.fn() },
}))

describe("auth store", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  it("maps the signin response onto user state and storage", async () => {
    request.post.mockResolvedValue({
      data: { data: { id: "u-1", name: "Ada Lovelace", email: "ada@example.com" } },
    })

    const store = useAuthStore()
    await store.signin("ada@example.com", "Testpass123!")

    const expected = { id: "u-1", name: "Ada Lovelace", email: "ada@example.com" }
    expect(store.user).toEqual(expected)
    expect(store.isAuthenticated).toBe(true)
    expect(getUserData()).toEqual(expected)
  })

  it("populates user state when getMe succeeds during initAuth", async () => {
    request.get.mockResolvedValue({
      data: { data: { id: "u-2", name: "Grace Hopper", email: "grace@example.com" } },
    })

    const store = useAuthStore()
    await store.initAuth()

    expect(store.user).toEqual({ id: "u-2", name: "Grace Hopper", email: "grace@example.com" })
  })

  it("clears user state when getMe fails during initAuth", async () => {
    request.get.mockRejectedValue(new Error("unauthorized"))

    const store = useAuthStore()
    await store.initAuth()

    expect(store.user).toBeNull()
    expect(store.isAuthenticated).toBe(false)
  })
})
