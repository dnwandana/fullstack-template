<script setup lang="ts">
/**
 * TopBar — 56px white header (artboard 05).
 *
 * Composition only, with one piece of logic: the "/" between the switchers has
 * to disappear with ProjectSwitcher, which hides itself when no project is
 * selected. Both test the same condition, from opposite sides.
 */

import { computed } from "vue"
import { RouterLink } from "vue-router"
import { MenuOutlined, AppstoreOutlined } from "@ant-design/icons-vue"
import { useTenantStore } from "@/stores/tenant"
import OrgSwitcher from "./OrgSwitcher.vue"
import ProjectSwitcher from "./ProjectSwitcher.vue"
import InvitationsBell from "./InvitationsBell.vue"
import UserMenu from "./UserMenu.vue"

defineEmits<{
  "toggle-drawer": []
}>()

const tenant = useTenantStore()

// The id, not the object: on a deep link the id is present from the first
// render while the project is still being fetched.
const hasProject = computed(() => Boolean(tenant.currentProjectId))
</script>

<template>
  <header class="top-bar">
    <div class="top-bar__left">
      <button
        type="button"
        class="top-bar__hamburger"
        aria-label="Open navigation"
        @click="$emit('toggle-drawer')"
      >
        <MenuOutlined />
      </button>

      <!-- The only way back to /orgs from inside an org: SideNav starts at
           Projects and AppBreadcrumb roots at the org, so without this,
           leaving an org means the browser back button or the URL bar. -->
      <RouterLink :to="{ name: 'OrgsList' }" class="top-bar__brand" aria-label="Organizations">
        <AppstoreOutlined />
      </RouterLink>

      <OrgSwitcher />
      <span v-if="hasProject" class="top-bar__sep" aria-hidden="true">/</span>
      <ProjectSwitcher />
    </div>

    <div class="top-bar__right">
      <InvitationsBell />
      <UserMenu />
    </div>
  </header>
</template>

<style scoped>
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 16px;
  background: var(--gray-0);
  border-bottom: 1px solid var(--gray-150);
}

.top-bar__left,
.top-bar__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.top-bar__sep {
  color: var(--gray-400);
}

.top-bar__hamburger {
  display: none;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
}

.top-bar__hamburger:hover {
  background: var(--gray-100);
}

.top-bar__brand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 6px;
  font-size: 18px;
  color: var(--text-secondary);
}

.top-bar__brand:hover {
  background: var(--gray-100);
  color: var(--text-primary);
}

/* Below 768px the sider is gone and navigation lives in a Drawer. */
@media (max-width: 767px) {
  .top-bar__hamburger {
    display: inline-flex;
  }
}
</style>
