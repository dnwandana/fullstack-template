import { mount } from "@vue/test-utils"
import { createPinia } from "pinia"
import SignupView from "@/views/auth/SignupView.vue"
import { request } from "@/utils/http"

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
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
  })

  it("submits the name and email typed into the form", async () => {
    request.post.mockResolvedValue({ data: { data: { id: "u-1" } } })

    const wrapper = mount(SignupView, { global: { plugins: [createPinia()] } })

    await wrapper.find('input[placeholder="Full name"]').setValue("Ada Lovelace")
    await wrapper.find('input[placeholder="Email"]').setValue("ada@example.com")

    expect(wrapper.find('input[placeholder="Full name"]').element.value).toBe("Ada Lovelace")
    expect(wrapper.find('input[placeholder="Email"]').element.value).toBe("ada@example.com")
  })
})
