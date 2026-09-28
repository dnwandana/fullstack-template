<script setup lang="ts">
/**
 * Shows a new invitation link after the clipboard copy fails. The API returns the raw token once,
 * so the admin copies the link from here. Emits `close` when the user closes the dialog.
 */
import InviteLinkField from "@/components/InviteLinkField.vue"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

defineProps<{ open: boolean; url: string | null }>()
const emit = defineEmits<{ close: [] }>()

function onOpenChange(open: boolean): void {
  if (!open) emit("close")
}
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New invitation link</DialogTitle>
        <DialogDescription
          >Copy this link and send it to the invitee. It is shown once.</DialogDescription
        >
      </DialogHeader>
      <InviteLinkField v-if="url" :url="url" />
    </DialogContent>
  </Dialog>
</template>
