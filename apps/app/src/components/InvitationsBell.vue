<script setup>
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
import { Badge } from "ant-design-vue"
import { BellOutlined } from "@ant-design/icons-vue"
import { useInvitations } from "@/composables/useInvitations"

const { pendingCount, fetchMyInvitations } = useInvitations()

onMounted(() => {
  fetchMyInvitations()
})
</script>

<template>
  <RouterLink :to="{ name: 'MyInvitations' }" class="invitations-bell" aria-label="Invitations">
    <Badge :count="pendingCount" :offset="[-2, 4]">
      <BellOutlined class="invitations-bell__icon" />
    </Badge>
  </RouterLink>
</template>

<style scoped>
.invitations-bell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 6px;
  color: var(--text-secondary);
}

.invitations-bell:hover {
  background: var(--gray-100);
  color: var(--text-primary);
}

.invitations-bell__icon {
  font-size: 16px;
}
</style>
