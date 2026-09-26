<script setup lang="ts">
/**
 * AppBreadcrumb — org / project / page trail.
 *
 * Built from tenant context rather than from route.matched: the routes are flat
 * (no nesting), so matched contains only the leaf and carries no ancestor to
 * walk. Org and project names come from the stores, with an id fallback for the
 * window before a deep link's fetch lands.
 */

import { computed } from "vue"
import { useRoute, RouterLink } from "vue-router"
import type { RouteLocationRaw } from "vue-router"
import { useTenantStore } from "@/stores/tenant"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

const route = useRoute()
const tenant = useTenantStore()

interface Crumb {
  label: string
  /** `null` on the crumb for the page you are already on — it is not a link. */
  to: RouteLocationRaw | null
}

/** Route name → final crumb label. Routes absent here add no page crumb. */
const PAGE_LABELS: Record<string, string> = {
  OrgMembers: "Members",
  OrgRoles: "Roles",
  OrgInvitations: "Invitations",
  OrgSettings: "Settings",
  OrgAuditLog: "Audit Logs",
  ProjectMembers: "Members",
  ProjectInvitations: "Invitations",
  ProjectSettings: "Settings",
  TodoDetail: "Todo",
}

const crumbs = computed<Crumb[]>(() => {
  const trail: Crumb[] = []
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
  const pageLabel = typeof route.name === "string" ? PAGE_LABELS[route.name] : undefined
  if (pageLabel) trail.push({ label: pageLabel, to: null })

  // The final crumb is where you already are, so it is never a link.
  trail[trail.length - 1].to = null
  return trail
})

defineExpose({ crumbs })
</script>

<template>
  <Breadcrumb v-if="crumbs.length" aria-label="Breadcrumb">
    <BreadcrumbList>
      <template v-for="(crumb, index) in crumbs" :key="index">
        <BreadcrumbSeparator v-if="index > 0" />
        <BreadcrumbItem>
          <BreadcrumbLink v-if="crumb.to" as-child>
            <RouterLink :to="crumb.to">{{ crumb.label }}</RouterLink>
          </BreadcrumbLink>
          <BreadcrumbPage v-else>{{ crumb.label }}</BreadcrumbPage>
        </BreadcrumbItem>
      </template>
    </BreadcrumbList>
  </Breadcrumb>
</template>
