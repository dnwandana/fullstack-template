import { mount, flushPromises } from "@vue/test-utils"
import { createPinia } from "pinia"
import SignupView from "@/views/auth/SignupView.vue"
import { ok, makeUser } from "@/test/fixtures"
import { request } from "@/utils/http"

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))

// `currentRoute.query` is mutated per test to simulate arriving from an invite link.
const { currentRoute } = vi.hoisted(() => ({ currentRoute: { query: {} } }))

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => currentRoute,
}))

describe("SignupView", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    currentRoute.query = {}
  })

  it("submits the name and email typed into the form", async () => {
    vi.mocked(request.post).mockResolvedValue(ok(makeUser({ id: "u-1" })))

    const wrapper = mount(SignupView, { global: { plugins: [createPinia()] } })

    await wrapper.find('input[placeholder="Full name"]').setValue("Ada Lovelace")
    await wrapper.find('input[placeholder="Email"]').setValue("ada@example.com")

    expect(wrapper.find<HTMLInputElement>('input[placeholder="Full name"]').element.value).toBe(
      "Ada Lovelace",
    )
    expect(wrapper.find<HTMLInputElement>('input[placeholder="Email"]').element.value).toBe(
      "ada@example.com",
    )
  })

  it("prefills and locks the email when arriving from an invite link", async () => {
    currentRoute.query = { email: "new@acme.com", redirect: "/invite/inv-1?token=abc" }

    const wrapper = mount(SignupView, { global: { plugins: [createPinia()] } })
    await flushPromises()

    const email = wrapper.find<HTMLInputElement>('input[placeholder="Email"]')
    expect(email.element.value).toBe("new@acme.com")
    expect(email.element.disabled).toBe(true)
  })

  it("leaves the email editable on a normal signup", async () => {
    const wrapper = mount(SignupView, { global: { plugins: [createPinia()] } })
    await flushPromises()

    const email = wrapper.find<HTMLInputElement>('input[placeholder="Email"]')
    expect(email.element.value).toBe("")
    expect(email.element.disabled).toBe(false)
  })

  // Review Focus 1: the locked invite email reaches the request body.
  it("submits the locked email from the query string", async () => {
    currentRoute.query = { email: "new@acme.com" }
    vi.mocked(request.post).mockResolvedValue(ok(makeUser({ id: "u-1" })))
    const wrapper = mount(SignupView, { global: { plugins: [createPinia()] } })
    await wrapper.find('input[placeholder="Full name"]').setValue("Grace")
    await wrapper.find('input[placeholder="Password (min 8 characters)"]').setValue("password123")
    await wrapper.find('input[placeholder="Confirm Password"]').setValue("password123")
    await wrapper.find("form").trigger("submit")
    // VeeValidate validates through an async Zod parse. One flush is not enough.
    await vi.waitFor(() => expect(request.post).toHaveBeenCalled())
    await flushPromises()
    const [, body] = vi.mocked(request.post).mock.calls[0] ?? []
    expect(body).toMatchObject({ email: "new@acme.com" })
  })
})
