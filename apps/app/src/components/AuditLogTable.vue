<script setup lang="ts">
/**
 * AuditLogTable — Displays audit log rows in a shadcn Table.
 *
 * Features:
 *   - Color-coded action Badges with humanized labels
 *   - Expandable rows that show the `changes` diff, one line per field
 *   - Project name lookup through the projectNames prop
 *
 * Props:
 *   - logs: array of audit log rows
 *   - loading: shows a Spinner while true
 *   - pagination: pagination metadata from the API envelope
 *   - projectNames: map of project id to project name
 *
 * Emits:
 *   - page-change(page) — when the user selects a page other than the current page
 */

import { ref } from "vue"
import { ChevronRight } from "@lucide/vue"
import type { AuditLog, PaginationMeta, Wire } from "@fullstack/contracts"
import { Badge, type BadgeVariants } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationFirst,
  PaginationItem,
  PaginationLast,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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

/** Returns the humanized label for an action, or the raw string. */
function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

/**
 * Map an action to a Badge variant. The spec colors match by suffix, so custom
 * entity types inherit the scheme.
 */
function actionVariant(action: string): BadgeVariants["variant"] {
  if (action.endsWith(".created")) return "success"
  if (action.endsWith(".updated") || action === "member.role_changed") return "info"
  if (action.endsWith(".deleted") || action === "invitation.revoked") return "destructive"
  return "secondary"
}

/** Returns the project name for a row, or a dash for org-level actions. */
function projectLabel(projectId: string | null): string {
  if (!projectId) return "—"
  return props.projectNames[projectId] ?? "—"
}

/** Formats a row's timestamp as a locale date string. */
function formatWhen(createdAt: string | null | undefined): string {
  if (!createdAt) return "—"
  return new Date(createdAt).toLocaleDateString()
}

/** Returns one display line per changed field for the expanded row. */
function changeLines(changes: Wire<AuditLog>["changes"]): string[] {
  if (!changes) return []
  return Object.entries(changes).map(
    ([field, diff]) => `${field}: ${JSON.stringify(diff.from)} → ${JSON.stringify(diff.to)}`,
  )
}

// Ids of the rows whose change diff is open. A new Set on each toggle triggers reactivity.
const expanded = ref<Set<string>>(new Set())

function toggle(id: string): void {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

/** Emits only for a page other than the current page. */
function onPageChange(page: number): void {
  if (page !== props.pagination.current_page) emit("page-change", page)
}
</script>

<template>
  <div class="space-y-4">
    <div class="relative rounded-md border">
      <Spinner v-if="loading" class="absolute top-2 right-2" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-8" />
            <TableHead>When</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Project</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-for="log in logs" :key="log.id">
            <TableRow>
              <TableCell>
                <Button
                  v-if="log.changes !== null"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Show changes"
                  :aria-expanded="expanded.has(log.id)"
                  @click="toggle(log.id)"
                >
                  <ChevronRight
                    class="size-4 transition-transform"
                    :class="{ 'rotate-90': expanded.has(log.id) }"
                  />
                </Button>
              </TableCell>
              <TableCell>{{ formatWhen(log.created_at) }}</TableCell>
              <TableCell>{{ log.actor_name }}</TableCell>
              <TableCell>
                <Badge :variant="actionVariant(log.action)">{{ actionLabel(log.action) }}</Badge>
              </TableCell>
              <TableCell>{{ log.entity_name }}</TableCell>
              <TableCell>{{ projectLabel(log.project_id) }}</TableCell>
            </TableRow>
            <TableRow v-if="log.changes !== null && expanded.has(log.id)">
              <TableCell :colspan="6" class="bg-muted/50">
                <div
                  v-for="line in changeLines(log.changes)"
                  :key="line"
                  class="change-line font-mono text-xs"
                >
                  {{ line }}
                </div>
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
    </div>

    <Pagination
      v-if="pagination.total_pages > 1"
      :page="pagination.current_page"
      :total="pagination.total_items"
      :items-per-page="pagination.items_per_page"
      :sibling-count="1"
      show-edges
      @update:page="onPageChange"
    >
      <PaginationContent v-slot="{ items }">
        <PaginationFirst />
        <PaginationPrevious />
        <template v-for="(item, index) in items" :key="index">
          <PaginationItem
            v-if="item.type === 'page'"
            :value="item.value"
            :is-active="item.value === pagination.current_page"
          >
            {{ item.value }}
          </PaginationItem>
          <PaginationEllipsis v-else :index="index" />
        </template>
        <PaginationNext />
        <PaginationLast />
      </PaginationContent>
    </Pagination>
  </div>
</template>
