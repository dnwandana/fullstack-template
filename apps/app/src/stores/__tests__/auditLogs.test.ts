import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { request } from "@/utils/http"

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))

import { useAuditLogsStore } from "../auditLogs"
import { makeAuditLog, okPaginated } from "@/test/fixtures"

describe("auditLogs store", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it("fetches logs and stores rows and pagination", async () => {
    const row = makeAuditLog()
    vi.mocked(request.get).mockResolvedValue(okPaginated([row]))

    const store = useAuditLogsStore()
    await store.fetchAuditLogs("org-1")

    expect(request.get).toHaveBeenCalledWith("/orgs/org-1/audit-logs", expect.any(Object))
    expect(store.logs).toEqual([row])
    expect(store.pagination.total_items).toBe(1)
    expect(store.loading).toBe(false)
  })

  it("sends the active filters as params", async () => {
    vi.mocked(request.get).mockResolvedValue(okPaginated([]))

    const store = useAuditLogsStore()
    store.action = "todo.created"
    store.searchQuery = "spec"
    await store.fetchAuditLogs("org-1")

    expect(request.get).toHaveBeenCalledWith(
      "/orgs/org-1/audit-logs",
      expect.objectContaining({ action: "todo.created", search: "spec" }),
    )
  })

  it("keeps state and clears loading when the request rejects", async () => {
    vi.mocked(request.get).mockRejectedValue(new Error("network"))

    const store = useAuditLogsStore()
    await store.fetchAuditLogs("org-1")

    expect(store.logs).toEqual([])
    expect(store.loading).toBe(false)
  })
})
