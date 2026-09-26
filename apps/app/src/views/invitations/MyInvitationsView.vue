<script setup lang="ts">
/**
 * MyInvitationsView — Displays the current user's received invitations in a table.
 *
 * Features:
 *   - Fetches the user's invitations on mount
 *   - Skeleton loading state while data is being fetched
 *   - Empty state when there are no invitations
 *   - Table with columns: Organization, Project, Status (Badge variant), Expires, Actions
 *   - Open-invitation and Decline actions for pending invitations
 *   - ConfirmDialog on Decline to prevent accidental rejection
 */

import { onMounted } from "vue"
import { useRouter } from "vue-router"
import { useInvitations } from "@/composables/useInvitations"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import PageHeader from "@/components/PageHeader.vue"
import { Badge, type BadgeVariants } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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

/**
 * Map invitation status strings to Badge variants.
 * `status` is a plain string, not a union: the database column carries no constraint, so the
 * trailing "secondary" is a reachable branch rather than dead code.
 */
function statusVariant(status: string): BadgeVariants["variant"] {
  if (status === "pending") {
    return "warning"
  }
  if (status === "accepted") {
    return "success"
  }
  if (status === "declined") {
    return "destructive"
  }
  return "secondary"
}

/**
 * Format an ISO date string into a user-friendly locale representation.
 * The falsy guard stays even though `expires_at` is non-nullable — it also covers the empty
 * string, and dropping it would be a behaviour change.
 */
function formatDate(dateString: string): string {
  if (!dateString) {
    return "-"
  }
  return new Date(dateString).toLocaleString()
}

// Fetch the current user's invitations on mount
onMounted(() => {
  fetchMyInvitations()
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="My Invitations" />

    <!-- Loading skeleton shown while fetching and no invitations are cached yet -->
    <div v-if="loading && myInvitations.length === 0" class="space-y-2">
      <Skeleton v-for="n in 3" :key="n" class="h-10 w-full" />
    </div>

    <!-- Empty state when loading is complete but there are no invitations -->
    <Empty v-else-if="!loading && myInvitations.length === 0">
      <EmptyHeader>
        <EmptyTitle>No pending invitations</EmptyTitle>
      </EmptyHeader>
    </Empty>

    <!-- Invitations table -->
    <div v-else class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organization</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="invitation in myInvitations" :key="invitation.id">
            <TableCell>{{ invitation.org_name }}</TableCell>
            <TableCell>{{ invitation.project_name ?? "-" }}</TableCell>
            <TableCell>
              <Badge :variant="statusVariant(invitation.status)">{{ invitation.status }}</Badge>
            </TableCell>
            <TableCell>{{ formatDate(invitation.expires_at) }}</TableCell>
            <TableCell>
              <!-- Actions show only for pending invitations. Decline asks for confirmation. -->
              <div v-if="invitation.status === 'pending'" class="flex items-center gap-2">
                <Button size="sm" @click="goToInvite(invitation.id)">Open invitation</Button>
                <ConfirmDialog
                  title="Are you sure you want to decline this invitation?"
                  confirm-label="Yes"
                  destructive
                  @confirm="handleDecline(invitation.id)"
                >
                  <Button variant="destructive" size="sm">Decline</Button>
                </ConfirmDialog>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
