<script setup lang="ts">
/**
 * InvitationsBell — pending-invitation count, linking to /invitations.
 *
 * A link rather than a dropdown: no artboard shows that dropdown open, and
 * MyInvitationsView already renders the list.
 *
 * Owns its own fetch so TopBar does not have to know the badge needs data.
 */

import { onMounted } from "vue"
import { RouterLink } from "vue-router"
import { Bell } from "@lucide/vue"
import { Button } from "@/components/ui/button"
import { useInvitations } from "@/composables/useInvitations"

const { pendingCount, fetchMyInvitations } = useInvitations()

onMounted(() => {
  fetchMyInvitations()
})
</script>

<template>
  <RouterLink :to="{ name: 'MyInvitations' }" aria-label="Invitations" class="relative inline-flex">
    <Button variant="ghost" size="icon-sm" as="span">
      <Bell />
    </Button>
    <span
      v-if="pendingCount > 0"
      data-slot="bell-count"
      class="absolute top-px right-0 h-4 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] leading-4 font-semibold text-destructive-foreground tabular-nums ring-2 ring-background"
      >{{ pendingCount }}</span
    >
  </RouterLink>
</template>
