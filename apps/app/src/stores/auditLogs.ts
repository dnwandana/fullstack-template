/**
 * Audit logs store - manages the read-only audit log list for one org.
 * The org id is passed to every fetch; the filter refs feed the list query.
 */

import type { AuditLog, PaginationMeta, Wire } from "@fullstack/contracts"
import { defineStore } from "pinia"
import { ref } from "vue"
import { getAuditLogs, type AuditLogListParams } from "@/api/auditLogs"

export const useAuditLogsStore = defineStore("auditLogs", () => {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const logs = ref<Wire<AuditLog>[]>([])
  const pagination = ref<PaginationMeta>({
    current_page: 1,
    total_pages: 0,
    total_items: 0,
    items_per_page: 10,
    has_next_page: false,
    has_previous_page: false,
    next_page: null,
    previous_page: null,
  })
  const loading = ref(false)

  // Filter params — undefined means "do not filter on this field"
  const projectId = ref<string | undefined>(undefined)
  const actorId = ref<string | undefined>(undefined)
  const action = ref<string | undefined>(undefined)
  const entityType = ref<string | undefined>(undefined)
  const dateFrom = ref<string | undefined>(undefined)
  const dateTo = ref<string | undefined>(undefined)

  // Search params
  const searchQuery = ref("")

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Fetch a paginated list of audit logs for an org.
   * The query merges the stored pagination, filter, and search state;
   * explicit `params` entries win over the stored values.
   */
  async function fetchAuditLogs(
    orgId: string,
    params: Partial<AuditLogListParams> = {},
  ): Promise<void> {
    loading.value = true
    try {
      const response = await getAuditLogs(orgId, {
        page: pagination.value.current_page,
        limit: pagination.value.items_per_page,
        sort_order: "desc",
        project_id: projectId.value,
        actor_id: actorId.value,
        action: action.value,
        entity_type: entityType.value,
        date_from: dateFrom.value,
        date_to: dateTo.value,
        search: searchQuery.value || undefined,
        ...params,
      })
      logs.value = response.data.data
      pagination.value = response.data.pagination
    } catch {
      // The http layer already toasts the error.
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    logs,
    pagination,
    loading,
    projectId,
    actorId,
    action,
    entityType,
    dateFrom,
    dateTo,
    searchQuery,
    // Actions
    fetchAuditLogs,
  }
})
