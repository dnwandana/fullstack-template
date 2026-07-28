import { setActivePinia, createPinia } from "pinia"
import { useAuth } from "@/composables/useAuth"
import { request } from "@/utils/http"

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))

// A single stable router/route pair so post-auth navigation can be asserted.
// `currentRoute.query` is mutated per test to simulate arriving with ?redirect=.
const { push, currentRoute } = vi.hoisted(() => {
  const currentRoute: { query: Record<string, string> } = { query: {} }
  return { push: vi.fn(), currentRoute }
})

vi.mock("vue-router", () => ({
  useRouter: () => ({ push }),
  useRoute: () => currentRoute,
}))

vi.mock("ant-design-vue", () => ({
  message: { success: vi.fn(), error: vi.fn() },
}))

describe("useAuth argument chain", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
    currentRoute.query = {}
  })

  it("posts every signup field in the correct position", async () => {
    vi.mocked(request.post).mockResolvedValue({ data: { data: { id: "u-1" } }, status: 200 })

    const { formState, handleSignup } = useAuth()
    formState.name = "Ada Lovelace"
    formState.email = "ada@example.com"
    formState.password = "Testpass123!"
    formState.confirmation_password = "Testpass123!"

    await handleSignup()

    expect(request.post).toHaveBeenCalledWith("/auth/signup", {
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
    })
  })

  it("posts every signin field in the correct position", async () => {
    vi.mocked(request.post).mockResolvedValue({
      data: { data: { id: "u-1", name: "Ada Lovelace", email: "ada@example.com" } },
      status: 200,
    })

    const { formState, handleSignin } = useAuth()
    formState.email = "ada@example.com"
    formState.password = "Testpass123!"

    await handleSignin()

    expect(request.post).toHaveBeenCalledWith("/auth/signin", {
      email: "ada@example.com",
      password: "Testpass123!",
    })
  })

  it("returns to the invite link after signin when ?redirect= is a relative path", async () => {
    vi.mocked(request.post).mockResolvedValue({
      data: { data: { id: "u-1", name: "Ada Lovelace", email: "ada@example.com" } },
      status: 200,
    })
    currentRoute.query = { redirect: "/invite/inv-1?token=abc" }

    const { handleSignin } = useAuth()
    await handleSignin()

    expect(push).toHaveBeenCalledWith("/invite/inv-1?token=abc")
  })

  it("refuses an off-site redirect after signin", async () => {
    vi.mocked(request.post).mockResolvedValue({
      data: { data: { id: "u-1", name: "Ada Lovelace", email: "ada@example.com" } },
      status: 200,
    })
    currentRoute.query = { redirect: "//evil.example.com/steal" }

    const { handleSignin } = useAuth()
    await handleSignin()

    expect(push).toHaveBeenCalledWith("/orgs")
  })

  it("carries the redirect from signup through to login", async () => {
    vi.mocked(request.post).mockResolvedValue({ data: { data: { id: "u-1" } }, status: 200 })
    currentRoute.query = { redirect: "/invite/inv-1?token=abc" }

    const { handleSignup } = useAuth()
    await handleSignup()

    expect(push).toHaveBeenCalledWith({
      path: "/login",
      query: { redirect: "/invite/inv-1?token=abc" },
    })
  })

  it("sends signup to a bare login page when there is no redirect", async () => {
    vi.mocked(request.post).mockResolvedValue({ data: { data: { id: "u-1" } }, status: 200 })

    const { handleSignup } = useAuth()
    await handleSignup()

    expect(push).toHaveBeenCalledWith({ path: "/login", query: {} })
  })

  it("clears both name and email on resetForm", () => {
    const { formState, resetForm } = useAuth()
    formState.name = "Ada Lovelace"
    formState.email = "ada@example.com"

    resetForm()

    expect(formState.name).toBe("")
    expect(formState.email).toBe("")
  })
})
