import { describe, it, expect, beforeEach, vi } from "vitest"
import { mount } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"
import { request } from "@/utils/http"

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: { name: "RouterLink", props: ["to"], template: "<a><slot /></a>" },
}))

vi.mock("ant-design-vue", async (importOriginal) => ({
  ...(await importOriginal()),
  message: { success: vi.fn(), error: vi.fn() },
}))

import InvitationsBell from "./InvitationsBell.vue"

const PENDING = [
  { id: "i1", status: "pending" },
  { id: "i2", status: "pending" },
]

describe("InvitationsBell", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    request.get.mockReset().mockResolvedValue({ data: { data: PENDING } })
  })

  it("fetches the caller's invitations on mount", async () => {
    mount(InvitationsBell)
    await vi.waitFor(() => expect(request.get).toHaveBeenCalledWith("/invitations"))
  })

  it("shows the pending count", async () => {
    const wrapper = mount(InvitationsBell)
    await vi.waitFor(() => expect(wrapper.text()).toContain("2"))
  })

  it("links to the invitations page", () => {
    const wrapper = mount(InvitationsBell)
    expect(wrapper.findComponent({ name: "RouterLink" }).props("to")).toEqual({
      name: "MyInvitations",
    })
  })
})
