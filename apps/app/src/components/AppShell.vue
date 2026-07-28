<script setup lang="ts">
/**
 * AppShell — sider + top bar + breadcrumb + routed content.
 *
 * Replaces AppLayout and AppSidebar. Renders RouterView itself rather than
 * taking a slot, so App.vue no longer nests one inside it.
 */

import { ref, computed, watch, onMounted, onUnmounted } from "vue"
import type { Ref } from "vue"
import { useRoute, RouterView } from "vue-router"
import { Layout, Drawer } from "ant-design-vue"
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons-vue"
import { useTenantStore } from "@/stores/tenant"
import SideNav from "./SideNav.vue"
import TopBar from "./TopBar.vue"
import AppBreadcrumb from "./AppBreadcrumb.vue"

const STORAGE_KEY = "shell.collapsed"
const MOBILE = "(max-width: 767px)"
const NARROW = "(min-width: 768px) and (max-width: 991px)"

const route = useRoute()
const tenant = useTenantStore()

// The org switcher and breadcrumb both derive `currentOrg` from
// `orgsStore.orgs`, but nothing fetches it — the shell owns that trigger so a
// deep link straight into an org (bookmark, refresh, email link) still
// resolves the org name instead of showing a raw UUID / nothing. Guarded
// against duplicate calls inside the store itself, so this stays a no-op
// alongside OrgsListView's own `fetchOrgs()` once the cache is warm.
onMounted(() => {
  tenant.loadOrgs()
})

// Authoritative permission loader for the shell. SideNav gates its items on
// `can()`, which reads tenant.permissions[currentOrgId]; keeping that cache
// populated for whatever org is in the route is the shell's job, not any one
// view's. Watching `permissionsReady` (false whenever the current org has no
// cached set) covers all three cases with one guard: first paint, switching
// orgs, and — crucially — a mutation invalidating the cache mid-session. On
// invalidation `permissionsReady` flips false and this re-resolves the gap,
// instead of leaving the nav and permission-gated buttons blank until the
// next navigation remounts a view. loadPermissions is idempotent, so the
// views' own onMounted calls stay harmless no-ops.
watch(
  (): [string | null, boolean] => [tenant.currentOrgId, tenant.permissionsReady],
  ([orgId, ready]) => {
    if (orgId && !ready) tenant.loadPermissions(orgId)
  },
  { immediate: true },
)

const isMobile = ref(false)
const isNarrow = ref(false)
const drawerOpen = ref(false)

// The user's preference, kept apart from the effective value below: a narrow
// viewport forces the rail, and must not overwrite what the user chose.
const preferCollapsed = ref(localStorage.getItem(STORAGE_KEY) === "true")

const collapsed = computed(() => isNarrow.value || preferCollapsed.value)

function toggleCollapsed() {
  preferCollapsed.value = !preferCollapsed.value
  localStorage.setItem(STORAGE_KEY, String(preferCollapsed.value))
}

const teardown: (() => void)[] = []

// Read synchronously (during setup, before the first render) rather than
// from onMounted: the effective viewport is needed for the very first paint
// — e.g. so the sider never flashes before the drawer takes over below
// 768px — and only the "change" subscription needs cleanup on unmount.
function track(query: string, target: Ref<boolean>): void {
  const mql = window.matchMedia(query)
  target.value = mql.matches
  const onChange = (event: MediaQueryListEvent) => (target.value = event.matches)
  mql.addEventListener("change", onChange)
  teardown.push(() => mql.removeEventListener("change", onChange))
}

track(MOBILE, isMobile)
track(NARROW, isNarrow)

onUnmounted(() => teardown.forEach((off) => off()))

// The shell never unmounts, so the drawer would stay open across a navigation.
watch(
  () => route.fullPath,
  () => (drawerOpen.value = false),
)

defineExpose({ collapsed, toggleCollapsed, drawerOpen })
</script>

<template>
  <Layout class="app-shell">
    <Layout.Sider
      v-if="!isMobile"
      class="app-shell__sider"
      :width="210"
      :collapsed-width="56"
      :collapsed="collapsed"
      :trigger="null"
      collapsible
      theme="light"
    >
      <SideNav :collapsed="collapsed" />

      <button
        v-if="!isNarrow"
        type="button"
        class="app-shell__toggle"
        :aria-label="collapsed ? 'Expand navigation' : 'Collapse navigation'"
        @click="toggleCollapsed"
      >
        <MenuUnfoldOutlined v-if="collapsed" />
        <MenuFoldOutlined v-else />
      </button>
    </Layout.Sider>

    <Drawer
      v-else
      v-model:open="drawerOpen"
      class="app-shell__drawer"
      placement="left"
      :width="220"
      :body-style="{ padding: 0 }"
      :mask-style="{ background: 'rgba(14, 17, 20, 0.45)' }"
      :closable="false"
    >
      <SideNav />
    </Drawer>

    <Layout>
      <TopBar @toggle-drawer="drawerOpen = true" />
      <div class="app-shell__crumbs"><AppBreadcrumb /></div>
      <Layout.Content class="app-shell__content">
        <RouterView />
      </Layout.Content>
    </Layout>
  </Layout>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
}

.app-shell__sider {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--gray-150);
}

.app-shell__toggle {
  margin: auto 12px 12px;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
}

.app-shell__toggle:hover {
  background: var(--gray-100);
}

.app-shell__crumbs {
  padding: 12px 24px 0;
}

.app-shell__content {
  padding: 16px 24px 32px;
  background: var(--gray-25);
}
</style>
