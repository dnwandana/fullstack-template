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
 *   - loading: shows a Spinner while true
 *   - canUpdateRole: whether to show the role Select
 *   - canRemove: whether to show the remove (delete) button
 *
 * Emits:
 *   - roleChange({ userId, roleId }) — when a member's role is changed
 *   - remove(userId) — when a member is removed (after the ConfirmDialog)
 */

import { Trash2 } from "@lucide/vue"
import type { Role, Wire } from "@fullstack/contracts"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { MemberRow } from "@/composables/useMembers"

interface Props {
  members: MemberRow[]
  roles?: Wire<Role>[]
  loading?: boolean
  canUpdateRole?: boolean
  canRemove?: boolean
}

withDefaults(defineProps<Props>(), {
  roles: () => [],
  loading: false,
  canUpdateRole: false,
  canRemove: false,
})

const emit = defineEmits<{
  roleChange: [payload: { userId: string; roleId: string }]
  remove: [userId: string]
}>()

/**
 * Handle role change from the role Select.
 */
function handleRoleChange(userId: string, roleId: string): void {
  emit("roleChange", { userId, roleId })
}

/**
 * Handle member removal after the ConfirmDialog confirms.
 */
function handleRemove(userId: string): void {
  emit("remove", userId)
}

function formatDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString() : "—"
}
</script>

<template>
  <div class="relative rounded-md border">
    <Spinner v-if="loading" class="absolute top-2 right-2" />
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Joined</TableHead>
          <TableHead v-if="canRemove">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="member in members" :key="member.user_id">
          <TableCell>{{ member.name }}</TableCell>
          <TableCell>{{ member.email || "—" }}</TableCell>
          <TableCell>
            <Select
              v-if="canUpdateRole"
              :model-value="member.role_id"
              @update:model-value="(value) => handleRoleChange(member.user_id, String(value))"
            >
              <SelectTrigger class="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="role in roles" :key="role.id" :value="role.id">
                  {{ role.name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Badge v-else variant="secondary">{{ member.role_name }}</Badge>
          </TableCell>
          <TableCell>{{ formatDate(member.joined_at) }}</TableCell>
          <TableCell v-if="canRemove">
            <ConfirmDialog
              title="Are you sure you want to remove this member?"
              confirm-label="Yes"
              destructive
              @confirm="handleRemove(member.user_id)"
            >
              <Button variant="destructive" size="sm"><Trash2 /> Remove</Button>
            </ConfirmDialog>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
