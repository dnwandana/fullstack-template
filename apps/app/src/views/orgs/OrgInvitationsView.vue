<script setup lang="ts">
/**
 * OrgInvitationsView — sent invitations for an organization, with invite,
 * revoke and reissue.
 *
 * Extracted from the Invitations tab of OrgSettingsView. The table markup is
 * unchanged; data loads on mount rather than on tab click.
 */

import { computed, onMounted, ref } from "vue"
import { useRoute } from "vue-router"
import { Copy, Plus } from "@lucide/vue"
import { toast } from "vue-sonner"

import type { InviteInput } from "@/api/invitations"
import { useInvitations } from "@/composables/useInvitations"
import { useRoles } from "@/composables/useRoles"
import { usePermissions } from "@/composables/usePermissions"
import { useAuthStore } from "@/stores/auth"
import InviteFormModal from "@/components/InviteFormModal.vue"
import InvitationsTable from "@/components/InvitationsTable.vue"
import PageHeader from "@/components/PageHeader.vue"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

const route = useRoute()
const authStore = useAuthStore()
const orgId = String(route.params.orgId)

const invitationsComposable = useInvitations()
const rolesComposable = useRoles()
const { can, loadPermissions } = usePermissions()

const {
  orgInvitations,
  fetchOrgInvitations,
  isInviteModalVisible,
  openInviteModal,
  closeInviteModal,
  handleInvite,
  handleRevoke,
  handleResend,
} = invitationsComposable
const { roles, fetchRoles } = rolesComposable

const invitationsLoading = computed(() => invitationsComposable.loading.value)

/** The new invitation link, shown in a dialog when the clipboard write fails. */
const fallbackUrl = ref<string | null>(null)

/** Invite payload from InviteFormModal */
function onInviteSubmit(data: InviteInput): void {
  handleInvite(orgId, data, "org")
}

function onRevoke(invitationId: string): void {
  handleRevoke(orgId, invitationId)
}

/**
 * Reissue a pending invitation and put the fresh link on the clipboard.
 * The template ships no mail provider, so the admin delivers the link by hand —
 * and the raw token is only ever returned once, at the moment it is minted.
 */
async function onResend(invitationId: string): Promise<void> {
  const result = await handleResend(orgId, invitationId)
  if (!result?.accept_url) {
    return
  }

  try {
    await navigator.clipboard.writeText(result.accept_url)
    toast.success("Invitation link copied to clipboard")
  } catch {
    // navigator.clipboard requires a secure context — it works over https and
    // on http://localhost, but not on a plain-HTTP LAN address. Show the link
    // instead of losing it: this token is never retrievable again.
    fallbackUrl.value = result.accept_url
  }
}

/** Copies the link from the fallback dialog. The dialog stays open if the copy fails. */
async function copyFallback(): Promise<void> {
  try {
    await navigator.clipboard.writeText(fallbackUrl.value ?? "")
    toast.success("Invitation link copied to clipboard")
  } catch {
    toast.error("Copy failed. Select the link and copy it by hand.")
  }
}

onMounted(() => {
  loadPermissions(orgId, authStore.currentUser?.id)
  fetchOrgInvitations(orgId)
  // Roles feed the role dropdown inside InviteFormModal.
  fetchRoles(orgId)
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Invitations">
      <!-- Invite member button — gated by permission -->
      <Button v-if="can('invitations:create')" @click="openInviteModal()">
        <Plus /> Invite Member
      </Button>
    </PageHeader>
    <InvitationsTable
      :invitations="orgInvitations"
      :loading="invitationsLoading"
      :can-revoke="can('invitations:manage')"
      :can-resend="can('invitations:manage')"
      @revoke="onRevoke"
      @resend="onResend"
    />
    <InviteFormModal
      :open="isInviteModalVisible"
      :roles="roles"
      :loading="invitationsLoading"
      @submit="onInviteSubmit"
      @cancel="closeInviteModal()"
    />

    <Dialog
      :open="fallbackUrl !== null"
      @update:open="
        (open) => {
          if (!open) fallbackUrl = null
        }
      "
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New invitation link</DialogTitle>
          <DialogDescription>
            Copy this link and send it to the invitee. It is shown once.
          </DialogDescription>
        </DialogHeader>
        <div class="flex items-center gap-2">
          <Input :model-value="fallbackUrl ?? ''" readonly class="font-mono text-xs" />
          <Button variant="outline" size="icon" aria-label="Copy link" @click="copyFallback">
            <Copy />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
