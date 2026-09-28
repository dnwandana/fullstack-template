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
 *   - loading: shows skeleton rows while the first page loads
 *   - pagination: pagination metadata from the API envelope
 *   - projectNames: map of project id to project name
 *
 * Emits:
 *   - page-change(page) — when the user selects a page other than the current page
 */

import { ref } from "vue"
import { ChevronDown, ChevronRight } from "@lucide/vue"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateTime } from "@/utils/format"
import UserAvatar from "@/components/UserAvatar.vue"
import TableSkeletonRows, { type SkeletonColumn } from "@/components/TableSkeletonRows.vue"

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
  // An invitation is not an entity that the org owns, so its creation stays neutral.
  if (action === "invitation.created") return "secondary"
  if (action.endsWith(".created")) return "success"
  if (action.endsWith(".updated") || action === "member.role_changed") return "info"
  if (action.endsWith(".deleted") || action === "invitation.revoked") return "destructive"
  return "secondary"
}

/** Returns true when the row names a project that the lookup knows. */
function hasProject(projectId: string | null): boolean {
  return projectId !== null && props.projectNames[projectId] !== undefined
}

// The mockup leaves the chevron cell empty. TableSkeletonRows draws a bar in every cell, so a
// 16 px bar marks the place of the chevron.
const SKELETON_COLUMNS: SkeletonColumn[] = [
  { width: 16 },
  { width: 130 },
  { width: 100 },
  { width: 110 },
  { width: 180 },
  { width: 110 },
]

/** Returns the project name for a row, or a dash for org-level actions. */
function projectLabel(projectId: string | null): string {
  if (!projectId) return "—"
  return props.projectNames[projectId] ?? "—"
}

interface ChangeLine {
  field: string
  from: string
  to: string
}

/** Returns one line per changed field. JSON keeps the quotes on strings, as in the mockup. */
function changeLines(changes: Wire<AuditLog>["changes"]): ChangeLine[] {
  if (!changes) return []
  return Object.entries(changes).map(([field, diff]) => ({
    field,
    from: JSON.stringify(diff.from),
    to: JSON.stringify(diff.to),
  }))
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-[44px] p-0"><span class="sr-only">Expand</span></TableHead>
          <TableHead class="w-[180px]">When</TableHead>
          <TableHead class="w-[170px]">Actor</TableHead>
          <TableHead class="w-[190px]">Action</TableHead>
          <TableHead>Entity</TableHead>
          <TableHead class="w-[170px]">Project</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableSkeletonRows
          v-if="loading && logs.length === 0"
          :rows="5"
          :columns="SKELETON_COLUMNS"
        />
        <template v-for="log in logs" :key="log.id">
          <TableRow :class="{ 'bg-muted/60 hover:bg-muted/60': expanded.has(log.id) }">
            <TableCell class="w-[44px] py-0 pr-0 pl-1.5 whitespace-nowrap">
              <Button
                v-if="log.changes !== null"
                variant="ghost"
                size="icon-sm"
                aria-label="Show changes"
                :aria-expanded="expanded.has(log.id)"
                @click="toggle(log.id)"
              >
                <ChevronDown v-if="expanded.has(log.id)" />
                <ChevronRight v-else />
              </Button>
            </TableCell>
            <TableCell class="whitespace-nowrap text-muted-foreground tabular-nums">
              {{ formatDateTime(log.created_at) }}
            </TableCell>
            <TableCell class="whitespace-nowrap">
              <div class="flex items-center gap-2">
                <UserAvatar :name="log.actor_name" :size="22" />
                <span data-slot="actor-name" class="font-medium">{{ log.actor_name }}</span>
              </div>
            </TableCell>
            <TableCell class="whitespace-nowrap">
              <Badge :variant="actionVariant(log.action)">{{ actionLabel(log.action) }}</Badge>
            </TableCell>
            <TableCell class="max-w-0 truncate" :title="log.entity_name">{{
              log.entity_name
            }}</TableCell>
            <TableCell
              :class="['whitespace-nowrap', !hasProject(log.project_id) && 'text-muted-foreground']"
            >
              {{ projectLabel(log.project_id) }}
            </TableCell>
          </TableRow>
          <TableRow
            v-if="log.changes !== null && expanded.has(log.id)"
            class="bg-muted/60 hover:bg-muted/60"
          >
            <TableCell :colspan="6" class="pt-1 pr-3 pb-3 pl-14">
              <div class="grid gap-1 font-mono text-xs leading-[18px]">
                <div v-for="line in changeLines(log.changes)" :key="line.field" class="change-line">
                  <span class="text-muted-foreground">{{ line.field }}:</span> {{ line.from }}
                  <span class="text-muted-foreground">→</span> {{ line.to }}
                </div>
              </div>
            </TableCell>
          </TableRow>
        </template>
      </TableBody>
    </Table>

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
