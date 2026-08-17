/**
 * Audit logs composable - view-facing layer over the audit logs store.
 * Re-exposes the list state as computed refs and owns the page, filter,
 * and search handlers. It holds no state of its own.
 */

import { computed } from "vue"
import { useAuditLogsStore } from "@/stores/auditLogs"

/**
 * Composable for the org-level audit log page.
 * The org id is passed to every handler because the audit log list is
 * scoped to one org and the store holds no tenant context.
 */
export function useAuditLogs() {
  const store = useAuditLogsStore()

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  const logs = computed(() => store.logs)
  const pagination = computed(() => store.pagination)
  const loading = computed(() => store.loading)

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /** Handle a page change by fetching the requested page. */
  async function handlePageChange(orgId: string, page: number): Promise<void> {
    await store.fetchAuditLogs(orgId, { page })
  }

  /**
   * Handle a filter change by re-fetching from page 1.
   * The store reads the filter refs itself, so no filter values pass here.
   */
  async function handleFilterChange(orgId: string): Promise<void> {
    await store.fetchAuditLogs(orgId, { page: 1 })
  }

  /** Handle a search by setting the query and re-fetching from page 1. */
  async function handleSearch(orgId: string, query: string): Promise<void> {
    store.searchQuery = query
    await store.fetchAuditLogs(orgId, { page: 1 })
  }

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    // Store state (exposed as computed for reactivity without direct mutation)
    logs,
    pagination,
    loading,
    // Actions
    handlePageChange,
    handleFilterChange,
    handleSearch,
  }
}
