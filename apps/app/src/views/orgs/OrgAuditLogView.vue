<script setup lang="ts">
/**
 * OrgAuditLogView — the org-level audit log page: filter bar, table, and a
 * two-branch empty state.
 *
 * All filter state lives in the audit logs store. The view writes the store
 * refs and delegates every fetch to the useAuditLogs handlers.
 */

import { computed, onMounted } from "vue"
import { useRoute } from "vue-router"
import {
  Button,
  Empty,
  InputSearch,
  RangePicker,
  Select,
  Space,
  Typography,
} from "ant-design-vue"

import AuditLogTable from "@/components/AuditLogTable.vue"
import { useAuditLogs } from "@/composables/useAuditLogs"
import { useAuditLogsStore } from "@/stores/auditLogs"
import { useMembersStore } from "@/stores/members"
import { useProjectsStore } from "@/stores/projects"

const route = useRoute()
const orgId = String(route.params.orgId)

const store = useAuditLogsStore()
const projectsStore = useProjectsStore()
const membersStore = useMembersStore()

const { logs, pagination, loading, handlePageChange, handleFilterChange, handleSearch } =
  useAuditLogs()

// The same 20 actions AuditLogTable.vue labels. Kept as a static list: the
// API exposes no action catalog endpoint.
const ACTION_OPTIONS = [
  { value: "org.created", label: "Created org" },
  { value: "org.updated", label: "Updated org" },
  { value: "org.deleted", label: "Deleted org" },
  { value: "project.created", label: "Created project" },
  { value: "project.updated", label: "Updated project" },
  { value: "project.deleted", label: "Deleted project" },
  { value: "todo.created", label: "Created todo" },
  { value: "todo.updated", label: "Updated todo" },
  { value: "todo.deleted", label: "Deleted todo" },
  { value: "role.created", label: "Created role" },
  { value: "role.updated", label: "Updated role" },
  { value: "role.deleted", label: "Deleted role" },
  { value: "member.added", label: "Added member" },
  { value: "member.role_changed", label: "Changed member role" },
  { value: "member.removed", label: "Removed member" },
  { value: "invitation.created", label: "Sent invitation" },
  { value: "invitation.resent", label: "Resent invitation" },
  { value: "invitation.revoked", label: "Revoked invitation" },
  { value: "invitation.accepted", label: "Accepted invitation" },
  { value: "invitation.declined", label: "Declined invitation" },
]

const projectOptions = computed(() =>
  projectsStore.projects.map((project) => ({ value: project.id, label: project.name })),
)

const memberOptions = computed(() =>
  membersStore.orgMembers.map((member) => ({ value: member.user_id, label: member.name })),
)

/** Project id → name map for the table's Project column. */
const projectNames = computed<Record<string, string>>(() =>
  Object.fromEntries(projectsStore.projects.map((project) => [project.id, project.name])),
)

const hasActiveFilters = computed(() =>
  Boolean(
    store.projectId ||
      store.actorId ||
      store.action ||
      store.entityType ||
      store.dateFrom ||
      store.dateTo ||
      store.searchQuery,
  ),
)

/**
 * RangePicker value, derived from the store so Clear filters resets the
 * control. `value-format` keeps the binding in ISO date strings — the API
 * validates `date_from`/`date_to` with `@IsISO8601`.
 */
const dateRange = computed<[string, string] | undefined>(() =>
  store.dateFrom && store.dateTo ? [store.dateFrom, store.dateTo] : undefined,
)

async function onFilterChange(): Promise<void> {
  await handleFilterChange(orgId)
}

/** The second argument holds the ISO strings; a clear yields ["", ""]. */
async function onDateRangeChange(_value: unknown, dateStrings: [string, string]): Promise<void> {
  store.dateFrom = dateStrings[0] || undefined
  store.dateTo = dateStrings[1] || undefined
  await handleFilterChange(orgId)
}

async function onSearch(value: string): Promise<void> {
  await handleSearch(orgId, value)
}

async function clearFilters(): Promise<void> {
  store.projectId = undefined
  store.actorId = undefined
  store.action = undefined
  store.entityType = undefined
  store.dateFrom = undefined
  store.dateTo = undefined
  store.searchQuery = ""
  await handleFilterChange(orgId)
}

onMounted(() => {
  store.fetchAuditLogs(orgId)
  // Projects and members feed the filter selects; projects also feed the
  // table's Project column.
  projectsStore.fetchProjects(orgId)
  membersStore.fetchOrgMembers(orgId)
})
</script>

<template>
  <div class="org-audit-log">
    <Typography.Title :level="4" style="margin-bottom: 24px">Audit Logs</Typography.Title>

    <!-- Filter bar: every control writes the store, then refetches page 1 -->
    <Space wrap style="margin-bottom: 16px">
      <Select
        v-model:value="store.projectId"
        :options="projectOptions"
        placeholder="Project"
        allow-clear
        style="width: 180px"
        @change="onFilterChange"
      />
      <Select
        v-model:value="store.actorId"
        :options="memberOptions"
        placeholder="Member"
        allow-clear
        style="width: 180px"
        @change="onFilterChange"
      />
      <Select
        v-model:value="store.action"
        :options="ACTION_OPTIONS"
        placeholder="Action"
        allow-clear
        style="width: 200px"
        @change="onFilterChange"
      />
      <RangePicker :value="dateRange" value-format="YYYY-MM-DD" @change="onDateRangeChange" />
      <InputSearch
        v-model:value="store.searchQuery"
        placeholder="Search entries..."
        allow-clear
        style="width: 220px"
        @search="onSearch"
      />
    </Space>

    <AuditLogTable
      v-if="logs.length > 0 || loading"
      :logs="logs"
      :loading="loading"
      :pagination="pagination"
      :project-names="projectNames"
      @page-change="(page) => handlePageChange(orgId, page)"
    />

    <!-- Two-branch empty state: Clear filters appears only when a filter is set -->
    <Empty
      v-else
      :description="hasActiveFilters ? 'No entries match your filters' : 'No audit entries yet'"
    >
      <Button v-if="hasActiveFilters" @click="clearFilters">Clear filters</Button>
    </Empty>
  </div>
</template>

<style scoped>
.org-audit-log {
  width: 100%;
}
</style>
