<script setup lang="ts">
/**
 * AuditLogTable — Displays audit log rows in an Ant Design table.
 *
 * Features:
 *   - Color-coded action tags with humanized labels
 *   - Expandable rows that show the `changes` diff, one line per field
 *   - Project name lookup through the projectNames prop
 *
 * Props:
 *   - logs: array of audit log rows
 *   - loading: table loading state
 *   - pagination: pagination metadata from the API envelope
 *   - projectNames: map of project id to project name
 *
 * Emits:
 *   - page-change(page) — when the user selects a different page
 */

import { Table, Tag } from "ant-design-vue"
import type { ColumnsType } from "ant-design-vue/es/table"
import type { AuditLog, PaginationMeta, Wire } from "@fullstack/contracts"

const props = defineProps<{
  logs: Wire<AuditLog>[]
  loading: boolean
  pagination: PaginationMeta
  projectNames: Record<string, string>
}>()

const emit = defineEmits<{
  "page-change": [page: number]
}>()

// Display map for known actions. Unknown actions fall back to the raw string,
// so a new API action renders without a frontend release.
const ACTION_LABELS: Record<string, string> = {
  "org.created": "Created org",
  "org.updated": "Updated org",
  "org.deleted": "Deleted org",
  "project.created": "Created project",
  "project.updated": "Updated project",
  "project.deleted": "Deleted project",
  "todo.created": "Created todo",
  "todo.updated": "Updated todo",
  "todo.deleted": "Deleted todo",
  "role.created": "Created role",
  "role.updated": "Updated role",
  "role.deleted": "Deleted role",
  "member.added": "Added member",
  "member.role_changed": "Changed member role",
  "member.removed": "Removed member",
  "invitation.created": "Sent invitation",
  "invitation.resent": "Resent invitation",
  "invitation.revoked": "Revoked invitation",
  "invitation.accepted": "Accepted invitation",
  "invitation.declined": "Declined invitation",
}

/**
 * Look a row up in the table's own data-source by id. The `#bodyCell` slot
 * types `record` as `Record<string, any>`, so handlers take `record.id` — a
 * string — and recover the typed object here without an assertion.
 */
function findLog(id: string): Wire<AuditLog> | undefined {
  return props.logs.find((log) => log.id === id)
}

/** Returns the humanized label for a row's action, or the raw string. */
function actionLabel(id: string): string {
  const action = findLog(id)?.action ?? ""
  return ACTION_LABELS[action] ?? action
}

/**
 * Map an action to a Tag color. The spec colors match by suffix, so custom
 * entity types inherit the scheme.
 */
function actionColor(id: string): string {
  const action = findLog(id)?.action ?? ""
  if (action.endsWith(".created")) return "green"
  if (action.endsWith(".updated") || action === "member.role_changed") return "blue"
  if (action.endsWith(".deleted") || action === "invitation.revoked") return "red"
  return "default"
}

/** Returns the project name for a row, or a dash for org-level actions. */
function projectLabel(id: string): string {
  const projectId = findLog(id)?.project_id
  if (!projectId) return "—"
  return props.projectNames[projectId] ?? "—"
}

/** Formats a row's timestamp as a locale date string. */
function formatWhen(id: string): string {
  const createdAt = findLog(id)?.created_at
  if (!createdAt) return "—"
  return new Date(createdAt).toLocaleDateString()
}

/** Returns one display line per changed field for the expanded row. */
function changeLines(id: string): string[] {
  const changes = findLog(id)?.changes
  if (!changes) return []
  return Object.entries(changes).map(
    ([field, diff]) => `${field}: ${JSON.stringify(diff.from)} → ${JSON.stringify(diff.to)}`,
  )
}

const columns: ColumnsType<Wire<AuditLog>> = [
  { title: "When", dataIndex: "created_at", key: "created_at" },
  { title: "Actor", dataIndex: "actor_name", key: "actor_name" },
  { title: "Action", key: "action" },
  { title: "Entity", dataIndex: "entity_name", key: "entity_name" },
  { title: "Project", key: "project" },
]
</script>

<template>
  <Table
    :columns="columns"
    :data-source="props.logs"
    :loading="props.loading"
    row-key="id"
    :row-expandable="(record) => record.changes !== null"
    :pagination="{
      current: props.pagination.current_page,
      pageSize: props.pagination.items_per_page,
      total: props.pagination.total_items,
      onChange: (page: number) => emit('page-change', page),
    }"
  >
    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'created_at'">
        {{ formatWhen(record.id) }}
      </template>
      <template v-else-if="column.key === 'action'">
        <Tag :color="actionColor(record.id)">{{ actionLabel(record.id) }}</Tag>
      </template>
      <template v-else-if="column.key === 'project'">
        {{ projectLabel(record.id) }}
      </template>
    </template>
    <template #expandedRowRender="{ record }">
      <p v-for="line in changeLines(record.id)" :key="line" class="change-line">{{ line }}</p>
    </template>
  </Table>
</template>

<style scoped>
.change-line {
  margin: 0;
  font-family: var(--font-mono, monospace);
}
</style>
