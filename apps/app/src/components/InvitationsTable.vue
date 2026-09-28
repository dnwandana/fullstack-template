<script setup lang="ts">
/**
 * InvitationsTable — Displays a list of invitations in a shadcn Table.
 *
 * Features:
 *   - Color-coded status Badges (pending, expired, accepted, declined)
 *   - Optional revoke button with confirmation (only for pending invitations)
 *   - Optional "New link" button that reissues the invitation (pending only)
 *
 * Props:
 *   - invitations: array of invitation objects
 *   - loading: shows skeleton rows while the first load runs
 *   - canRevoke: whether to show the revoke action
 *   - canResend: whether to show the reissue ("New link") action
 *   - revokeAction: revokes one invitation. The confirm dialog waits for its promise.
 *
 * The actions column is rendered when either action is enabled.
 * Scope shows the project name, or Organization for an org invitation.
 *
 * Emits:
 *   - resend(invitationId) — when the user asks for a fresh invitation link
 */

import { Link } from "@lucide/vue"
import { computed } from "vue"
import type { InvitationListItem, Wire } from "@fullstack/contracts"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import { Badge, type BadgeVariants } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/utils/format"
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

interface Props {
  invitations?: Wire<InvitationListItem>[]
  loading?: boolean
  canRevoke?: boolean
  canResend?: boolean
  revokeAction?: (invitationId: string) => Promise<unknown>
}

const props = withDefaults(defineProps<Props>(), {
  invitations: () => [],
  loading: false,
  canRevoke: false,
  canResend: false,
})

const emit = defineEmits<{
  resend: [invitationId: string]
}>()

const hasActions = computed(() => props.canRevoke || props.canResend)

const skeletonColumns = computed<SkeletonColumn[]>(() => [
  { width: 200 },
  { width: 56 },
  { width: 90 },
  { width: 64 },
  { width: 90 },
  { width: 90 },
  ...(hasActions.value ? [{ width: 140, align: "end" as const }] : []),
])

/**
 * Display status for an invitation row.
 * `expired` is derived, not stored — nothing writes that status to the
 * database, so a stale row stays `pending` forever without this.
 */
function displayStatus(record: Wire<InvitationListItem>): string {
  if (record.status === "pending" && new Date(record.expires_at) < new Date()) {
    return "expired"
  }
  return record.status
}

/**
 * Map a display status to a Badge variant.
 * There is deliberately no "revoked" branch — revoking hard-deletes the row,
 * so that status can never be observed.
 */
function statusVariant(status: string): BadgeVariants["variant"] {
  if (status === "accepted") return "success"
  if (status === "declined") return "destructive"
  if (status === "expired") return "secondary"
  return "warning"
}

/** Runs revokeAction for one invitation. The views always pass it together with canRevoke. */
function revokeInvitation(invitationId: string): Promise<unknown> {
  return props.revokeAction?.(invitationId) ?? Promise.resolve()
}

/**
 * Handle a request for a fresh invitation link.
 */
function handleResend(invitationId: string): void {
  emit("resend", invitationId)
}
</script>

<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Invitee</TableHead>
        <TableHead class="w-[100px]">Role</TableHead>
        <TableHead class="w-[130px]">Scope</TableHead>
        <TableHead class="w-[100px]">Status</TableHead>
        <TableHead class="w-[120px]">Expires</TableHead>
        <TableHead class="w-[120px]">Created</TableHead>
        <TableHead v-if="hasActions" class="w-[1%] text-right">Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableSkeletonRows
        v-if="loading && invitations.length === 0"
        :rows="4"
        :columns="skeletonColumns"
      />
      <TableEmpty v-else-if="invitations.length === 0" :colspan="hasActions ? 7 : 6">
        No invitations
      </TableEmpty>
      <TableRow v-for="invitation in invitations" :key="invitation.id">
        <!-- Legacy rows have no email, so fall back to the invitee id. -->
        <TableCell
          data-slot="invitee"
          :class="[
            'whitespace-nowrap',
            invitation.invitee_email ? 'font-medium' : 'font-mono text-xs text-muted-foreground',
          ]"
          >{{ invitation.invitee_email || invitation.invitee_id }}</TableCell
        >
        <TableCell>{{ invitation.role_name }}</TableCell>
        <TableCell class="whitespace-nowrap">{{
          invitation.project_name ?? "Organization"
        }}</TableCell>
        <TableCell>
          <!-- The derived status shows an elapsed expiry as "expired", not "pending". -->
          <Badge :variant="statusVariant(displayStatus(invitation))">
            {{ displayStatus(invitation) }}
          </Badge>
        </TableCell>
        <TableCell class="text-muted-foreground tabular-nums">{{
          formatDate(invitation.expires_at)
        }}</TableCell>
        <TableCell class="text-muted-foreground tabular-nums">{{
          formatDate(invitation.created_at)
        }}</TableCell>
        <TableCell v-if="hasActions" class="w-[1%] text-right">
          <!--
            Actions check the stored status, not displayStatus. An expired invitation
            is still stored as pending, and a new link is the recovery path for it.
            Accepted and declined invitations are terminal.
          -->
          <div v-if="invitation.status === 'pending'" class="flex items-center justify-end gap-0.5">
            <Button
              v-if="canResend"
              size="sm"
              variant="outline"
              @click="handleResend(invitation.id)"
            >
              <Link /> New link
            </Button>
            <ConfirmDialog
              v-if="canRevoke"
              title="Are you sure you want to revoke this invitation?"
              confirm-label="Yes"
              destructive
              :action="() => revokeInvitation(invitation.id)"
            >
              <Button variant="destructive" size="sm">Revoke</Button>
            </ConfirmDialog>
          </div>
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
</template>
