import { describe, it, expect, afterEach, vi } from "vitest"
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"
import { ok, okPaginated, makeOrg, makeOrgMember, makePermission, makeRole } from "@/test/fixtures"
import { request } from "@/utils/http"

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))

// `push` is hoisted so one spy survives every `useRouter()` call.
const { push } = await vi.hoisted(async () => {
  return { push: vi.fn() }
})
vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { orgId: "o1" }, query: {} }),
  useRouter: () => ({ push, replace: vi.fn() }),
}))

const { currentRoute } = await vi.hoisted(async () => {
  const { ref } = await import("vue")
  return { currentRoute: ref({ params: { orgId: "o1" } }) }
})
vi.mock("@/router", () => ({ default: { currentRoute } }))

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import OrgSettingsView from "../OrgSettingsView.vue"
import { useAuthStore } from "@/stores/auth"

const PERMS = ["org:update", "org:delete"]

function setup(permissionNames: string[]) {
  setActivePinia(createPinia())
  useAuthStore().user = { id: "u1", name: "Ada", email: "ada@example.com" }
  vi.mocked(request.get)
    .mockReset()
    .mockImplementation((url: string) => {
      if (url === "/orgs/o1") return Promise.resolve(ok(makeOrg({ description: "Rockets" })))
      if (url.endsWith("/members"))
        return Promise.resolve(okPaginated([makeOrgMember({ user_id: "u1", role_id: "r1" })]))
      if (url.includes("/roles/"))
        return Promise.resolve(
          ok(makeRole({ permissions: permissionNames.map((name) => makePermission({ name })) })),
        )
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
  return mount(OrgSettingsView, { attachTo: document.body })
}
const buttons = () => Array.from(document.body.querySelectorAll("button"))

describe("OrgSettingsView", () => {
  let wrapper: VueWrapper | undefined
  afterEach(() => wrapper?.unmount())

  it("fills the form from the fetched org", async () => {
    wrapper = setup(PERMS)
    await flushPromises()
    expect(wrapper.find<HTMLInputElement>('input[name="name"]').element.value).toBe("Acme")
    expect(wrapper.find<HTMLTextAreaElement>("textarea").element.value).toBe("Rockets")
  })

  it("saves the edited values through the store", async () => {
    vi.mocked(request.put).mockResolvedValue(ok(makeOrg({ name: "Acme 2" })))
    wrapper = setup(PERMS)
    await flushPromises()
    await wrapper.find('input[name="name"]').setValue("Acme 2")
    await wrapper.find("form").trigger("submit")
    // VeeValidate debounces validation by 5 ms, so flushPromises alone is too early.
    await vi.waitFor(() => expect(request.put).toHaveBeenCalled())
    const [url, body] = vi.mocked(request.put).mock.calls[0] ?? []
    expect(url).toBe("/orgs/o1")
    expect(body).toMatchObject({ name: "Acme 2", description: "Rockets" })
  })

  it("hides Save and Delete without the permissions", async () => {
    wrapper = setup([])
    await flushPromises()
    expect(wrapper.text()).not.toContain("Save")
    expect(wrapper.text()).not.toContain("Delete Organization")
  })

  it("deletes after the dialog confirms, then leaves the org", async () => {
    vi.mocked(request.del).mockResolvedValue(ok(null))
    wrapper = setup(PERMS)
    await flushPromises()
    buttons()
      .find((b) => b.textContent?.trim() === "Delete Organization")
      ?.click()
    await flushPromises()
    buttons()
      .find((b) => b.textContent?.trim() === "Delete")
      ?.click()
    await vi.waitFor(() => expect(request.del).toHaveBeenCalledWith("/orgs/o1"))
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/orgs"))
  })
})
