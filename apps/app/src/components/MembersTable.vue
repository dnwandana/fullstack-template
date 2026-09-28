<script setup lang="ts">
/**
 * MembersTable — Displays organization or project members in a shadcn Table.
 *
 * Features:
 *   - Optional role Select (controlled by `canUpdateRole`)
 *   - Optional remove button with confirmation (controlled by `canRemove`)
 *
 * Props:
 *   - members: array of member objects
 *   - roles: available roles for the role Select
 *   - loading: shows skeleton rows while the first load runs
 *   - canUpdateRole: whether to show the role Select
 *   - canRemove: whether to show the remove (delete) button
 *   - removeAction: removes one member. The confirm dialog waits for its promise.
 *
 * Emits:
 *   - roleChange({ userId, roleId }) — when a member's role is changed
 */

import { Trash2 } from "@lucide/vue"
import { computed } from "vue"
import type { Role, Wire } from "@fullstack/contracts"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import TableSkeletonRows, { type SkeletonColumn } from "@/components/TableSkeletonRows.vue"
import UserAvatar from "@/components/UserAvatar.vue"
import type { MemberRow } from "@/composables/useMembers"
import { formatDate } from "@/utils/format"

interface Props {
  members: MemberRow[]
  roles?: Wire<Role>[]
  loading?: boolean
  canUpdateRole?: boolean
  canRemove?: boolean
  removeAction?: (userId: string) => Promise<unknown>
}

const props = withDefaults(defineProps<Props>(), {
  roles: () => [],
  loading: false,
  canUpdateRole: false,
  canRemove: false,
})

const emit = defineEmits<{
  roleChange: [payload: { userId: string; roleId: string }]
}>()

// The Actions column exists only for canRemove, so the skeleton matches the header.
const skeletonColumns = computed<SkeletonColumn[]>(() => [
  { avatar: "circle", width: 110 },
  { width: 180 },
  { width: 90 },
  { width: 90 },
  ...(props.canRemove ? [{ width: 84, align: "end" as const }] : []),
])

/**
 * Handle role change from the role Select.
 */
function handleRoleChange(userId: string, roleId: string): void {
  emit("roleChange", { userId, roleId })
}

/** Runs removeAction for one member. The views always pass it together with canRemove. */
function removeMember(userId: string): Promise<unknown> {
  return props.removeAction?.(userId) ?? Promise.resolve()
}
</script>

<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Email</TableHead>
        <TableHead class="w-[164px]">Role</TableHead>
        <TableHead class="w-[140px]">Joined</TableHead>
        <TableHead v-if="canRemove" class="w-[1%] text-right">Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableSkeletonRows
        v-if="loading && members.length === 0"
        :rows="4"
        :columns="skeletonColumns"
      />
      <TableEmpty v-else-if="members.length === 0" :colspan="canRemove ? 5 : 4">
        No members
      </TableEmpty>
      <TableRow v-for="member in members" :key="member.user_id">
        <TableCell>
          <div class="flex items-center gap-2.5 whitespace-nowrap">
            <UserAvatar :name="member.name" :size="28" />
            <span data-slot="member-name" class="font-medium">{{ member.name }}</span>
          </div>
        </TableCell>
        <TableCell class="text-muted-foreground">{{ member.email || "—" }}</TableCell>
        <TableCell>
          <Select
            v-if="canUpdateRole"
            :model-value="member.role_id"
            @update:model-value="(value) => handleRoleChange(member.user_id, String(value))"
          >
            <SelectTrigger class="h-8 w-[140px]" aria-label="Role"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="role in roles" :key="role.id" :value="role.id">
                {{ role.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Badge v-else variant="secondary">{{ member.role_name }}</Badge>
        </TableCell>
        <TableCell class="text-muted-foreground tabular-nums">{{
          formatDate(member.joined_at)
        }}</TableCell>
        <TableCell v-if="canRemove" class="w-[1%] text-right">
          <ConfirmDialog
            title="Are you sure you want to remove this member?"
            confirm-label="Yes"
            destructive
            :action="() => removeMember(member.user_id)"
          >
            <Button variant="destructive" size="sm"><Trash2 /> Remove</Button>
          </ConfirmDialog>
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
</template>
