import { setActivePinia, createPinia } from "pinia"
import { request } from "@/utils/http"

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))

import { useAuditLogs } from "../useAuditLogs"
import { useAuditLogsStore } from "@/stores/auditLogs"
import { makeAuditLog, okPaginated } from "@/test/fixtures"

describe("useAuditLogs", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(request.get).mockResolvedValue(okPaginated([makeAuditLog()]))
  })

  it("re-exposes store state", async () => {
    const { logs, loading } = useAuditLogs()
    await useAuditLogsStore().fetchAuditLogs("org-1")
    expect(logs.value).toHaveLength(1)
    expect(loading.value).toBe(false)
  })

  it("tracks the store's pagination reactively", async () => {
    const { pagination } = useAuditLogs()
    await useAuditLogsStore().fetchAuditLogs("org-1")
    expect(pagination.value.total_items).toBe(1)
  })

  it("handlePageChange fetches the requested page", async () => {
    const { handlePageChange } = useAuditLogs()
    await handlePageChange("org-1", 3)
    expect(request.get).toHaveBeenCalledWith(
      "/orgs/org-1/audit-logs",
      expect.objectContaining({ page: 3 }),
    )
  })

  it("handleFilterChange resets to page 1", async () => {
    const store = useAuditLogsStore()
    store.pagination.current_page = 4
    store.action = "todo.deleted"
    const { handleFilterChange } = useAuditLogs()
    await handleFilterChange("org-1")
    expect(request.get).toHaveBeenCalledWith(
      "/orgs/org-1/audit-logs",
      expect.objectContaining({ page: 1, action: "todo.deleted" }),
    )
  })

  it("handleSearch sets the query and resets to page 1", async () => {
    const store = useAuditLogsStore()
    store.pagination.current_page = 2
    const { handleSearch } = useAuditLogs()
    await handleSearch("org-1", "spec")
    expect(store.searchQuery).toBe("spec")
    expect(request.get).toHaveBeenCalledWith(
      "/orgs/org-1/audit-logs",
      expect.objectContaining({ page: 1, search: "spec" }),
    )
  })
})
