import { flushPromises, mount } from "@vue/test-utils"
import { createPinia } from "pinia"
import LoginView from "@/views/auth/LoginView.vue"
import { ok, makeUser } from "@/test/fixtures"
import { request } from "@/utils/http"

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ query: {} }),
}))

function mountView() {
  return mount(LoginView, { global: { plugins: [createPinia()] } })
}

describe("LoginView", () => {
  beforeEach(() => vi.clearAllMocks())

  it("shows the validation message for an empty email", async () => {
    const wrapper = mountView()
    await wrapper.find("form").trigger("submit")
    // VeeValidate validates through an async Zod parse. One flush is not enough.
    await vi.waitFor(() => expect(wrapper.text()).toContain("Please enter your email"))
    expect(request.post).not.toHaveBeenCalled()
  })

  it("posts the typed credentials", async () => {
    vi.mocked(request.post).mockResolvedValue(ok(makeUser({ id: "u-1" })))
    const wrapper = mountView()
    await wrapper.find('input[placeholder="Email"]').setValue("ada@example.com")
    await wrapper.find('input[placeholder="Password"]').setValue("password123")
    await wrapper.find("form").trigger("submit")
    await vi.waitFor(() => expect(request.post).toHaveBeenCalled())
    await flushPromises()
    const [, body] = vi.mocked(request.post).mock.calls[0] ?? []
    expect(body).toMatchObject({ email: "ada@example.com", password: "password123" })
  })
})
