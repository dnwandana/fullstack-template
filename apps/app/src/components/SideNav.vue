<script setup lang="ts">
/**
 * SideNav — permission-derived navigation for the application shell.
 *
 * Replaces AppSidebar, which selected between three hard-coded menu shapes by
 * matching the URL string, and highlighted the active item by comparing path
 * plus query. Here the item list is derived from route names and their
 * `meta.permission`, and the active item is whichever route name appears in
 * `route.matched` — the router already knows, so nothing is re-derived.
 */

import { computed, watch } from "vue"
import type { Component } from "vue"
import { useRoute, RouterLink } from "vue-router"
import {
  CheckSquare,
  FolderKanban,
  History,
  Mail,
  Settings,
  ShieldCheck,
  Users,
} from "@lucide/vue"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useTenantStore } from "@/stores/tenant"
import { usePermissions } from "@/composables/usePermissions"

const route = useRoute()
const tenant = useTenantStore()
const { can } = usePermissions()
const { setOpenMobile } = useSidebar()

// The shell never unmounts, so the mobile sheet would stay open after a navigation.
watch(
  () => route.fullPath,
  () => setOpenMobile(false),
)

interface NavItem {
  /** Route name — also what `selectedKeys` matches on. */
  key: string
  label: string
  icon: Component
  /** Mirrors the route's `meta.permission`; see 00-overview. */
  permission: string
  /** Extra route names that should keep this item lit. Defaults to `[key]`. */
  matches?: string[]
}

// `key` is the route name, which is also what selectedKeys matches on.
// `permission` mirrors the route's meta.permission — see 00-overview.
const ORG_ITEMS: NavItem[] = [
  { key: "ProjectsList", label: "Projects", icon: FolderKanban, permission: "project:read" },
  { key: "OrgMembers", label: "Members", icon: Users, permission: "org:read" },
  { key: "OrgRoles", label: "Roles", icon: ShieldCheck, permission: "org:read" },
  {
    key: "OrgInvitations",
    label: "Invitations",
    icon: Mail,
    permission: "invitations:manage",
  },
  { key: "OrgSettings", label: "Settings", icon: Settings, permission: "org:update" },
  { key: "OrgAuditLog", label: "Audit Logs", icon: History, permission: "audit:read" },
]

const PROJECT_ITEMS: NavItem[] = [
  {
    key: "TodosList",
    label: "Todos",
    icon: CheckSquare,
    permission: "todos:read",
    // TodoDetail has no nav item of its own — the routes are flat, so without
    // this it falls out of `route.matched` entirely and Todos goes dark while
    // viewing a single todo.
    matches: ["TodosList", "TodoDetail"],
  },
  { key: "ProjectMembers", label: "Members", icon: Users, permission: "project:read" },
  {
    key: "ProjectInvitations",
    label: "Invitations",
    icon: Mail,
    permission: "invitations:manage",
  },
  {
    key: "ProjectSettings",
    label: "Settings",
    icon: Settings,
    permission: "project:update",
  },
]

const items = computed(() => {
  if (!tenant.currentOrgId) return []
  const source = tenant.currentProjectId ? PROJECT_ITEMS : ORG_ITEMS
  return source.filter((item) => can(item.permission))
})

/**
 * Active item = whichever item's `matches` list (or, absent that, its own
 * key) intersects the route names the router already matched.
 */
const selectedKeys = computed(() => {
  const matchedNames = route.matched.map((r) => r.name)
  return items.value
    .filter((item) => (item.matches ?? [item.key]).some((name) => matchedNames.includes(name)))
    .map((item) => item.key)
})

/** Route params for an item — project items need both params. */
const params = computed(() => ({
  orgId: tenant.currentOrgId,
  ...(tenant.currentProjectId ? { projectId: tenant.currentProjectId } : {}),
}))

const groupLabel = computed(() => (tenant.currentProjectId ? "Project" : "Organization"))

defineExpose({ items, selectedKeys })
</script>

<template>
  <nav v-if="items.length" aria-label="Main">
    <SidebarGroup>
      <SidebarGroupLabel>{{ groupLabel }}</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem v-for="item in items" :key="item.key">
          <SidebarMenuButton
            as-child
            :is-active="selectedKeys.includes(item.key)"
            :tooltip="item.label"
          >
            <RouterLink :to="{ name: item.key, params }">
              <component :is="item.icon" />
              <span>{{ item.label }}</span>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  </nav>
</template>
