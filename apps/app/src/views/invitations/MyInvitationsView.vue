<script setup lang="ts">
/**
 * MyInvitationsView — Displays the current user's received invitations in a table.
 *
 * Features:
 *   - Fetches the user's invitations on mount
 *   - Skeleton rows inside the table
 *   - Empty state when there are no invitations
 *   - Table with columns: Organization, Project, Invited by, Role, Expires, Actions
 *   - Open-invitation and Decline actions for pending invitations
 *   - ConfirmDialog on Decline to prevent accidental rejection
 */

import { onMounted } from "vue"
import { useRouter } from "vue-router"
import { Mail } from "@lucide/vue"
import { useInvitations } from "@/composables/useInvitations"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import PageHeader from "@/components/PageHeader.vue"
import TableSkeletonRows, { type SkeletonColumn } from "@/components/TableSkeletonRows.vue"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate } from "@/utils/format"

const router = useRouter()
const { myInvitations, loading, fetchMyInvitations, handleDecline } = useInvitations()

/**
 * Navigate to the public invite landing page for an invitation.
 *
 * This list cannot accept directly: acceptance requires the raw token, which
 * only ever exists in the emailed link — hence "Open invitation" rather than
 * "Accept". Arriving there without a token renders the `no-token` state, which
 * explains that the link is the credential. It deliberately does NOT render
 * `invalid`: the invitation is fine, the browser just isn't carrying its code.
 *
 * Takes the id rather than the row, to match the sibling `handleDecline(id)` call.
 */
function goToInvite(invitationId: string): void {
  router.push({ name: "InviteAccept", params: { invitationId } })
}

// The widths come from the mockup skeleton. The actions bar covers both buttons.
const SKELETON_COLUMNS: SkeletonColumn[] = [
  { width: 120 },
  { width: 90 },
  { width: 100 },
  { width: 56 },
  { width: 90 },
  { width: 190, align: "end" },
]

// Fetch the current user's invitations on mount
onMounted(() => {
  fetchMyInvitations()
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="My Invitations" :loading="loading && myInvitations.length > 0" />

    <Empty v-if="!loading && myInvitations.length === 0">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Mail /></EmptyMedia>
        <EmptyTitle>No pending invitations</EmptyTitle>
      </EmptyHeader>
    </Empty>

    <Table v-else>
      <TableHeader>
        <TableRow>
          <TableHead>Organization</TableHead>
          <TableHead>Project</TableHead>
          <TableHead>Invited by</TableHead>
          <TableHead class="w-[100px]">Role</TableHead>
          <TableHead class="w-[120px]">Expires</TableHead>
          <TableHead class="w-[1%] text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableSkeletonRows
          v-if="loading && myInvitations.length === 0"
          :rows="3"
          :columns="SKELETON_COLUMNS"
        />
        <TableRow v-for="invitation in myInvitations" :key="invitation.id">
          <TableCell class="font-medium whitespace-nowrap">{{ invitation.org_name }}</TableCell>
          <TableCell
            :class="[
              'whitespace-nowrap',
              invitation.project_name === null && 'text-muted-foreground',
            ]"
            >{{ invitation.project_name ?? "-" }}</TableCell
          >
          <TableCell class="whitespace-nowrap">{{ invitation.inviter_name }}</TableCell>
          <TableCell>{{ invitation.role_name }}</TableCell>
          <TableCell class="whitespace-nowrap text-muted-foreground tabular-nums">{{
            formatDate(invitation.expires_at)
          }}</TableCell>
          <TableCell class="w-[1%] text-right">
            <!-- Actions show only for pending invitations. Decline asks for confirmation. -->
            <div v-if="invitation.status === 'pending'" class="flex items-center justify-end gap-2">
              <Button size="sm" @click="goToInvite(invitation.id)">Open invitation</Button>
              <ConfirmDialog
                title="Are you sure you want to decline this invitation?"
                confirm-label="Yes"
                destructive
                :action="() => handleDecline(invitation.id)"
              >
                <Button variant="destructive" size="sm">Decline</Button>
              </ConfirmDialog>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
