<script setup>
/**
 * AppBreadcrumb — org / project / page trail.
 *
 * Built from tenant context rather than from route.matched: the routes are flat
 * (no nesting), so matched contains only the leaf and carries no ancestor to
 * walk. Org and project names come from the stores, with an id fallback for the
 * window before a deep link's fetch lands.
 */

import { computed } from "vue"
import { useRoute } from "vue-router"
import { useTenantStore } from "@/stores/tenant"

const route = useRoute()
const tenant = useTenantStore()

/** Route name → final crumb label. Routes absent here add no page crumb. */
const PAGE_LABELS = {
  OrgMembers: "Members",
  OrgRoles: "Roles",
  OrgInvitations: "Invitations",
  OrgSettings: "Settings",
  ProjectMembers: "Members",
  ProjectInvitations: "Invitations",
  ProjectSettings: "Settings",
  TodoDetail: "Todo",
}

const crumbs = computed(() => {
  const trail = []
  const orgId = tenant.currentOrgId
  if (!orgId) return trail

  trail.push({
    label: tenant.currentOrg?.name ?? orgId,
    to: { name: "ProjectsList", params: { orgId } },
  })

  const projectId = tenant.currentProjectId
  if (projectId) {
    trail.push({
      label: tenant.currentProject?.name ?? projectId,
      to: { name: "TodosList", params: { orgId, projectId } },
    })
  }

  // ProjectsList and TodosList are already the targets of the crumbs above;
  // adding a page crumb for them would repeat the trail's own last link.
  const pageLabel = PAGE_LABELS[route.name]
  if (pageLabel) trail.push({ label: pageLabel, to: null })

  // The final crumb is where you already are, so it is never a link.
  trail[trail.length - 1].to = null
  return trail
})

defineExpose({ crumbs })
</script>

<template>
  <nav v-if="crumbs.length" class="app-breadcrumb" aria-label="Breadcrumb">
    <template v-for="(crumb, i) in crumbs" :key="i">
      <span v-if="i > 0" class="app-breadcrumb__sep" aria-hidden="true">/</span>
      <RouterLink v-if="crumb.to" :to="crumb.to" class="app-breadcrumb__link">
        {{ crumb.label }}
      </RouterLink>
      <span v-else class="app-breadcrumb__current" aria-current="page">{{ crumb.label }}</span>
    </template>
  </nav>
</template>

<style scoped>
.app-breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--text-sm);
}

.app-breadcrumb__sep {
  color: var(--text-faint);
}

.app-breadcrumb__link {
  color: var(--text-secondary);
}

.app-breadcrumb__current {
  color: var(--text-primary);
  font-weight: 600;
}
</style>
