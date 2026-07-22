import { setActivePinia, createPinia } from "pinia"
import { useAuth } from "@/composables/useAuth"
import { request } from "@/utils/http"

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("ant-design-vue", () => ({
  message: { success: vi.fn(), error: vi.fn() },
}))

describe("useAuth argument chain", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  it("posts every signup field in the correct position", async () => {
    request.post.mockResolvedValue({ data: { data: { id: "u-1" } } })

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
    request.post.mockResolvedValue({
      data: { data: { id: "u-1", name: "Ada Lovelace", email: "ada@example.com" } },
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

  it("clears both name and email on resetForm", () => {
    const { formState, resetForm } = useAuth()
    formState.name = "Ada Lovelace"
    formState.email = "ada@example.com"

    resetForm()

    expect(formState.name).toBe("")
    expect(formState.email).toBe("")
  })
})
