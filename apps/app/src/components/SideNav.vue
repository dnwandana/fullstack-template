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

import { computed } from "vue"
import type { Component } from "vue"
import { useRoute } from "vue-router"
import { Menu } from "ant-design-vue"
import {
  CheckSquareOutlined,
  ProjectOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  MailOutlined,
  SettingOutlined,
} from "@ant-design/icons-vue"
import { useTenantStore } from "@/stores/tenant"
import { usePermissions } from "@/composables/usePermissions"

withDefaults(defineProps<{ collapsed?: boolean }>(), { collapsed: false })

const route = useRoute()
const tenant = useTenantStore()
const { can } = usePermissions()

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
  { key: "ProjectsList", label: "Projects", icon: ProjectOutlined, permission: "project:read" },
  { key: "OrgMembers", label: "Members", icon: TeamOutlined, permission: "org:read" },
  { key: "OrgRoles", label: "Roles", icon: SafetyCertificateOutlined, permission: "org:read" },
  {
    key: "OrgInvitations",
    label: "Invitations",
    icon: MailOutlined,
    permission: "invitations:manage",
  },
  { key: "OrgSettings", label: "Settings", icon: SettingOutlined, permission: "org:update" },
]

const PROJECT_ITEMS: NavItem[] = [
  {
    key: "TodosList",
    label: "Todos",
    icon: CheckSquareOutlined,
    permission: "todos:read",
    // TodoDetail has no nav item of its own — the routes are flat, so without
    // this it falls out of `route.matched` entirely and Todos goes dark while
    // viewing a single todo.
    matches: ["TodosList", "TodoDetail"],
  },
  { key: "ProjectMembers", label: "Members", icon: TeamOutlined, permission: "project:read" },
  {
    key: "ProjectInvitations",
    label: "Invitations",
    icon: MailOutlined,
    permission: "invitations:manage",
  },
  {
    key: "ProjectSettings",
    label: "Settings",
    icon: SettingOutlined,
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

defineExpose({ items, selectedKeys })
</script>

<template>
  <nav v-if="items.length" class="side-nav">
    <Menu mode="inline" :inline-collapsed="collapsed" :selected-keys="selectedKeys">
      <Menu.Item v-for="item in items" :key="item.key">
        <template #icon><component :is="item.icon" /></template>
        <RouterLink :to="{ name: item.key, params }">{{ item.label }}</RouterLink>
      </Menu.Item>
    </Menu>
  </nav>
</template>

<style scoped>
.side-nav {
  padding: 8px;
}

/* Ant's inline Menu draws its active bar on the RIGHT via a pseudo-element,
   and colorActiveBarBorderSize/colorActiveBarWidth address only that bar.
   theme/antd.ts sets colorActiveBarBorderSize: 0 to suppress it; the artboard's
   3px LEFT bar is drawn here. Fill, text colour and radius still come from the
   Menu tokens. */
.side-nav :deep(.ant-menu-item-selected) {
  border-left: 3px solid var(--teal-500);
}

/* Keep unselected items aligned with selected ones despite the 3px border. */
.side-nav :deep(.ant-menu-item) {
  border-left: 3px solid transparent;
}
</style>
