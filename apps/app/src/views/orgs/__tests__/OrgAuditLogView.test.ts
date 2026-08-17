import { describe, it, expect, beforeEach, vi } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import { createPinia } from "pinia"
import type { Pinia } from "pinia"
import { ok, okPaginated, makeAuditLog, makeOrgMember, makeProject } from "@/test/fixtures"
import { request } from "@/utils/http"
import type { HttpResult } from "@/utils/http"

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))

vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { orgId: "org-1" }, query: {} }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

// vi.mock factories are hoisted above regular top-level statements, so a
// plain `const currentRoute = ref(...)` here would still be in its TDZ when
// the mock factory below runs. vi.hoisted is also hoisted, and awaiting it
// lets the ref exist before anything else in the file executes.
const { currentRoute } = await vi.hoisted(async () => {
  const { ref } = await import("vue")
  return { currentRoute: ref({ params: { orgId: "org-1" } }) }
})
vi.mock("@/router", () => ({ default: { currentRoute } }))

import OrgAuditLogView from "../OrgAuditLogView.vue"
import { useAuditLogsStore } from "@/stores/auditLogs"

/**
 * Route-aware GET stub: mounting also fires the projects and members
 * fetches that feed the filter selects, so one mockResolvedValue is not
 * enough. Only the audit-logs response varies per test.
 */
function stubGet(auditLogsResponse: HttpResult<unknown>): void {
  vi.mocked(request.get)
    .mockReset()
    .mockImplementation((url: string) => {
      if (url.endsWith("/audit-logs")) return Promise.resolve(auditLogsResponse)
      if (url.endsWith("/projects")) return Promise.resolve(ok([makeProject({ org_id: "org-1" })]))
      if (url.endsWith("/members"))
        return Promise.resolve(okPaginated([makeOrgMember({ org_id: "org-1" })]))
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
}

function mountView(pinia: Pinia) {
  return mount(OrgAuditLogView, { global: { plugins: [pinia] } })
}

describe("OrgAuditLogView", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  })

  it("fetches and renders audit logs on mount", async () => {
    stubGet(okPaginated([makeAuditLog()]))
    const wrapper = mountView(createPinia())
    await flushPromises()
    expect(request.get).toHaveBeenCalledWith("/orgs/org-1/audit-logs", expect.any(Object))
    expect(wrapper.text()).toContain("Ada Lovelace")
  })

  it("fetches the projects and members that feed the filter selects", async () => {
    stubGet(okPaginated([]))
    mountView(createPinia())
    await flushPromises()
    expect(request.get).toHaveBeenCalledWith("/orgs/org-1/projects")
    expect(request.get).toHaveBeenCalledWith("/orgs/org-1/members")
  })

  it("shows the no-entries empty state when there are no logs and no filters", async () => {
    stubGet(okPaginated([]))
    const wrapper = mountView(createPinia())
    await flushPromises()
    expect(wrapper.text()).toContain("No audit entries yet")
    expect(wrapper.text()).not.toContain("Clear filters")
  })

  it("shows the no-match empty state with a clear-filters button when filtered", async () => {
    stubGet(okPaginated([]))
    const pinia = createPinia()
    const wrapper = mountView(pinia)
    await flushPromises()
    const store = useAuditLogsStore(pinia)
    store.action = "todo.deleted"
    await flushPromises()
    expect(wrapper.text()).toContain("No entries match your filters")
    expect(wrapper.text()).toContain("Clear filters")
  })

  it("clears every filter and refetches when Clear filters is clicked", async () => {
    stubGet(okPaginated([]))
    const pinia = createPinia()
    const wrapper = mountView(pinia)
    await flushPromises()
    const store = useAuditLogsStore(pinia)
    store.action = "todo.deleted"
    store.searchQuery = "spec"
    await flushPromises()
    vi.mocked(request.get).mockClear()

    // The search input renders a button of its own, so select by label.
    const clearButton = wrapper.findAll("button").find((b) => b.text().includes("Clear filters"))
    expect(clearButton).toBeDefined()
    await clearButton?.trigger("click")
    await flushPromises()

    expect(store.action).toBeUndefined()
    expect(store.searchQuery).toBe("")
    expect(request.get).toHaveBeenCalledWith(
      "/orgs/org-1/audit-logs",
      expect.objectContaining({ page: 1 }),
    )
    expect(wrapper.text()).toContain("No audit entries yet")
  })
})
