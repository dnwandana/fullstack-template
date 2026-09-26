<script setup lang="ts">
/**
 * InvitationsBell — pending-invitation count, linking to /invitations.
 *
 * A link rather than the component inventory's Badge + Dropdown: no artboard
 * shows that dropdown open, and MyInvitationsView already renders the list.
 *
 * Owns its own fetch so TopBar does not have to know the badge needs data.
 */

import { onMounted } from "vue"
import { RouterLink } from "vue-router"
import { Bell } from "@lucide/vue"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useInvitations } from "@/composables/useInvitations"

const { pendingCount, fetchMyInvitations } = useInvitations()

onMounted(() => {
  fetchMyInvitations()
})
</script>

<template>
  <RouterLink :to="{ name: 'MyInvitations' }" aria-label="Invitations" class="relative inline-flex">
    <Button variant="ghost" size="icon" as="span">
      <Bell class="size-5" />
    </Button>
    <Badge
      v-if="pendingCount > 0"
      variant="destructive"
      class="absolute -top-1 -right-1 h-5 min-w-5 justify-center px-1 text-[10px]"
    >
      {{ pendingCount }}
    </Badge>
  </RouterLink>
</template>
