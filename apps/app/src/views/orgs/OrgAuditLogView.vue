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
import { CalendarIcon, Search } from "@lucide/vue"
import { parseDate, type DateValue } from "@internationalized/date"

import AuditLogTable from "@/components/AuditLogTable.vue"
import { useAuditLogs } from "@/composables/useAuditLogs"
import { useAuditLogsStore } from "@/stores/auditLogs"
import { useMembersStore } from "@/stores/members"
import { useProjectsStore } from "@/stores/projects"
import PageHeader from "@/components/PageHeader.vue"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RangeCalendar } from "@/components/ui/range-calendar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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

type DateRange = { start: DateValue | undefined; end: DateValue | undefined }

/** Calendar value, derived from the store so Clear filters resets the control. */
const dateRange = computed<DateRange>(() => ({
  start: store.dateFrom ? parseDate(store.dateFrom) : undefined,
  end: store.dateTo ? parseDate(store.dateTo) : undefined,
}))

/** Select items cannot hold an empty value. This sentinel stands for "no filter". */
const ALL = "all"

async function onFilterChange(): Promise<void> {
  await handleFilterChange(orgId)
}

/** `toString()` on a `CalendarDate` yields `YYYY-MM-DD`, which the API validates as ISO 8601. */
async function onDateRangeChange(range: DateRange): Promise<void> {
  store.dateFrom = range.start?.toString()
  store.dateTo = range.end?.toString()
  // Wait for the end date. A start date alone is not a complete filter.
  if (range.start && !range.end) return
  await handleFilterChange(orgId)
}

function selectValue(value: string | undefined): string {
  return value ?? ALL
}

function fromSelect(value: unknown): string | undefined {
  return value === ALL || value === null ? undefined : String(value)
}

async function onProjectChange(value: unknown): Promise<void> {
  store.projectId = fromSelect(value)
  await onFilterChange()
}

async function onActorChange(value: unknown): Promise<void> {
  store.actorId = fromSelect(value)
  await onFilterChange()
}

async function onActionChange(value: unknown): Promise<void> {
  store.action = fromSelect(value)
  await onFilterChange()
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

defineExpose({ onDateRangeChange })

onMounted(() => {
  store.fetchAuditLogs(orgId)
  // Projects and members feed the filter selects; projects also feed the
  // table's Project column.
  projectsStore.fetchProjects(orgId)
  membersStore.fetchOrgMembers(orgId)
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Audit Logs" />

    <!-- Filter bar: every control writes the store, then refetches page 1 -->
    <div class="flex flex-wrap gap-2">
      <Select :model-value="selectValue(store.projectId)" @update:model-value="onProjectChange">
        <SelectTrigger class="w-[180px]"><SelectValue placeholder="Project" /></SelectTrigger>
        <SelectContent>
          <SelectItem :value="ALL">All projects</SelectItem>
          <SelectItem v-for="option in projectOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>
      <Select :model-value="selectValue(store.actorId)" @update:model-value="onActorChange">
        <SelectTrigger class="w-[180px]"><SelectValue placeholder="Member" /></SelectTrigger>
        <SelectContent>
          <SelectItem :value="ALL">All members</SelectItem>
          <SelectItem v-for="option in memberOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>
      <Select :model-value="selectValue(store.action)" @update:model-value="onActionChange">
        <SelectTrigger class="w-[200px]"><SelectValue placeholder="Action" /></SelectTrigger>
        <SelectContent>
          <SelectItem :value="ALL">All actions</SelectItem>
          <SelectItem v-for="option in ACTION_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger as-child>
          <Button variant="outline" class="w-[240px] justify-start font-normal">
            <CalendarIcon class="size-4" />
            <span v-if="dateRange.start">{{ store.dateFrom }} – {{ store.dateTo ?? "…" }}</span>
            <span v-else class="text-muted-foreground">Date range</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-auto p-0" align="start">
          <RangeCalendar
            :model-value="dateRange"
            :number-of-months="2"
            @update:model-value="onDateRangeChange"
          />
        </PopoverContent>
      </Popover>

      <InputGroup class="w-[220px]">
        <InputGroupAddon><Search class="size-4" /></InputGroupAddon>
        <InputGroupInput
          v-model="store.searchQuery"
          placeholder="Search entries..."
          @keydown.enter="onSearch(store.searchQuery)"
        />
      </InputGroup>
    </div>

    <AuditLogTable
      v-if="logs.length > 0 || loading"
      :logs="logs"
      :loading="loading"
      :pagination="pagination"
      :project-names="projectNames"
      @page-change="(page) => handlePageChange(orgId, page)"
    />

    <!-- Two-branch empty state: Clear filters appears only when a filter is set -->
    <Empty v-else>
      <EmptyHeader>
        <EmptyTitle>{{
          hasActiveFilters ? "No entries match your filters" : "No audit entries yet"
        }}</EmptyTitle>
      </EmptyHeader>
      <EmptyContent v-if="hasActiveFilters">
        <Button variant="outline" @click="clearFilters">Clear filters</Button>
      </EmptyContent>
    </Empty>
  </div>
</template>
