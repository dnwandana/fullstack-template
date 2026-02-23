<script setup>
import { computed, h } from "vue"
import { useRoute, useRouter } from "vue-router"
import { Menu } from "ant-design-vue"
import {
  AppstoreOutlined,
  MailOutlined,
  ProjectOutlined,
  TeamOutlined,
  SettingOutlined,
  CheckSquareOutlined,
} from "@ant-design/icons-vue"

const route = useRoute()
const router = useRouter()

const orgId = computed(() => route.params.orgId)
const projectId = computed(() => route.params.projectId)

/**
 * Compute menu items based on current route context.
 * Three states: no org, org only, org + project.
 */
const menuItems = computed(() => {
  if (orgId.value && projectId.value) {
    // Project context: Todos, Members, Settings
    return [
      {
        key: `/orgs/${orgId.value}/projects/${projectId.value}`,
        icon: () => h(CheckSquareOutlined),
        label: "Todos",
      },
      {
        key: `/orgs/${orgId.value}/projects/${projectId.value}/settings?tab=members`,
        icon: () => h(TeamOutlined),
        label: "Members",
      },
      {
        key: `/orgs/${orgId.value}/projects/${projectId.value}/settings`,
        icon: () => h(SettingOutlined),
        label: "Settings",
      },
    ]
  }

  if (orgId.value) {
    // Org context: Projects, Members, Settings
    return [
      {
        key: `/orgs/${orgId.value}`,
        icon: () => h(ProjectOutlined),
        label: "Projects",
      },
      {
        key: `/orgs/${orgId.value}/settings?tab=members`,
        icon: () => h(TeamOutlined),
        label: "Members",
      },
      {
        key: `/orgs/${orgId.value}/settings`,
        icon: () => h(SettingOutlined),
        label: "Settings",
      },
    ]
  }

  // No org context: Organizations, Invitations
  return [
    {
      key: "/orgs",
      icon: () => h(AppstoreOutlined),
      label: "Organizations",
    },
    {
      key: "/invitations",
      icon: () => h(MailOutlined),
      label: "Invitations",
    },
  ]
})

/**
 * Determine the active (selected) menu key based on current route path and query.
 * For settings pages, checks query params to distinguish Settings vs Members.
 * Falls back to longest prefix match for sub-pages (e.g. todo detail).
 */
const selectedKeys = computed(() => {
  const path = route.path
  const query = route.query

  // First pass: exact path + query match
  for (const item of menuItems.value) {
    const [itemPath, itemQuery] = item.key.split("?")
    if (path !== itemPath) continue

    if (itemQuery) {
      // Item has a query string — only match if route query matches
      const itemParams = new URLSearchParams(itemQuery)
      const matches = [...itemParams].every(([k, v]) => query[k] === v)
      if (matches) return [item.key]
    } else {
      // Item has no query string — match only if route also has no relevant query
      // (prevents Settings from matching when ?tab=members is present)
      const queryKeys = Object.keys(query)
      if (queryKeys.length === 0 || !queryKeys.includes("tab")) {
        return [item.key]
      }
    }
  }

  // Fallback: find the best prefix match (for sub-pages like todo detail)
  const sorted = [...menuItems.value].sort(
    (a, b) => b.key.split("?")[0].length - a.key.split("?")[0].length,
  )
  for (const item of sorted) {
    const itemPath = item.key.split("?")[0]
    if (path.startsWith(itemPath)) {
      return [item.key]
    }
  }
  return []
})

/**
 * Handle menu item click — navigate to the item's route.
 */
function onMenuClick({ key }) {
  const [path, query] = key.split("?")
  if (query) {
    const params = new URLSearchParams(query)
    router.push({ path, query: Object.fromEntries(params) })
  } else {
    router.push(path)
  }
}
</script>

<template>
  <Menu
    mode="inline"
    :selected-keys="selectedKeys"
    :items="menuItems"
    @click="onMenuClick"
    style="border-right: none"
  />
</template>
