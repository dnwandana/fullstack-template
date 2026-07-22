import { mount, flushPromises } from "@vue/test-utils"
import { createPinia } from "pinia"
import SignupView from "@/views/auth/SignupView.vue"
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
  // jsdom does not implement matchMedia; Ant Design Vue's grid subscribes to it on mount.
  beforeAll(() => {
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    currentRoute.query = {}
  })

  it("submits the name and email typed into the form", async () => {
    request.post.mockResolvedValue({ data: { data: { id: "u-1" } } })

    const wrapper = mount(SignupView, { global: { plugins: [createPinia()] } })

    await wrapper.find('input[placeholder="Full name"]').setValue("Ada Lovelace")
    await wrapper.find('input[placeholder="Email"]').setValue("ada@example.com")

    expect(wrapper.find('input[placeholder="Full name"]').element.value).toBe("Ada Lovelace")
    expect(wrapper.find('input[placeholder="Email"]').element.value).toBe("ada@example.com")
  })

  it("prefills and locks the email when arriving from an invite link", async () => {
    currentRoute.query = { email: "new@acme.com", redirect: "/invite/inv-1?token=abc" }

    const wrapper = mount(SignupView, { global: { plugins: [createPinia()] } })
    await flushPromises()

    const email = wrapper.find('input[placeholder="Email"]')
    expect(email.element.value).toBe("new@acme.com")
    expect(email.element.disabled).toBe(true)
  })

  it("leaves the email editable on a normal signup", async () => {
    const wrapper = mount(SignupView, { global: { plugins: [createPinia()] } })
    await flushPromises()

    const email = wrapper.find('input[placeholder="Email"]')
    expect(email.element.value).toBe("")
    expect(email.element.disabled).toBe(false)
  })
})
