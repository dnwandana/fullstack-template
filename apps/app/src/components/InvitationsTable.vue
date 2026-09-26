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
 *   - loading: shows a Spinner while true
 *   - canRevoke: whether to show the revoke action
 *   - canResend: whether to show the reissue ("New link") action
 *
 * The actions column is rendered when either action is enabled.
 *
 * Emits:
 *   - revoke(invitationId) — when the user confirms revoking an invitation
 *   - resend(invitationId) — when the user asks for a fresh invitation link
 */

import type { InvitationListItem, Wire } from "@fullstack/contracts"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import { Badge, type BadgeVariants } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Props {
  invitations?: Wire<InvitationListItem>[]
  loading?: boolean
  canRevoke?: boolean
  canResend?: boolean
}

withDefaults(defineProps<Props>(), {
  invitations: () => [],
  loading: false,
  canRevoke: false,
  canResend: false,
})

const emit = defineEmits<{
  revoke: [invitationId: string]
  resend: [invitationId: string]
}>()

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

/**
 * Handle invitation revocation after the ConfirmDialog confirms.
 */
function handleRevoke(invitationId: string): void {
  emit("revoke", invitationId)
}

/**
 * Handle a request for a fresh invitation link.
 */
function handleResend(invitationId: string): void {
  emit("resend", invitationId)
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
          <TableHead>Invitee</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead>Created</TableHead>
          <TableHead v-if="canRevoke || canResend">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="invitation in invitations" :key="invitation.id">
          <!-- Legacy rows have no email, so fall back to the invitee id. -->
          <TableCell>{{ invitation.invitee_email || invitation.invitee_id }}</TableCell>
          <TableCell>
            <!-- The derived status shows an elapsed expiry as "expired", not "pending". -->
            <Badge :variant="statusVariant(displayStatus(invitation))">
              {{ displayStatus(invitation) }}
            </Badge>
          </TableCell>
          <TableCell>{{ formatDate(invitation.expires_at) }}</TableCell>
          <TableCell>{{ formatDate(invitation.created_at) }}</TableCell>
          <TableCell v-if="canRevoke || canResend">
            <!--
              Actions check the stored status, not displayStatus. An expired invitation
              is still stored as pending, and a new link is the recovery path for it.
              Accepted and declined invitations are terminal.
            -->
            <div v-if="invitation.status === 'pending'" class="flex items-center gap-2">
              <Button
                v-if="canResend"
                size="sm"
                variant="outline"
                @click="handleResend(invitation.id)"
              >
                New link
              </Button>
              <ConfirmDialog
                v-if="canRevoke"
                title="Are you sure you want to revoke this invitation?"
                confirm-label="Yes"
                destructive
                @confirm="handleRevoke(invitation.id)"
              >
                <Button variant="destructive" size="sm">Revoke</Button>
              </ConfirmDialog>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
