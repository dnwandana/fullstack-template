<script setup lang="ts">
/**
 * AppShell — sidebar + top bar + breadcrumb + routed content.
 *
 * Replaces AppLayout and AppSidebar. Renders RouterView itself rather than
 * taking a slot, so App.vue no longer nests one inside it.
 */

import { ref, computed, watch, onMounted } from "vue"
import { RouterView } from "vue-router"
import { useMediaQuery } from "@vueuse/core"
import { useTenantStore } from "@/stores/tenant"
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import SideNav from "./SideNav.vue"
import TopBar from "./TopBar.vue"
import AppBreadcrumb from "./AppBreadcrumb.vue"

const STORAGE_KEY = "shell.collapsed"
const NARROW = "(min-width: 768px) and (max-width: 991px)"

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

const isNarrow = useMediaQuery(NARROW)

function readPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

// The user's preference, kept apart from the effective value below: a narrow
// viewport forces the rail, and must not overwrite what the user chose.
const preferCollapsed = ref(readPreference())
const collapsed = computed(() => isNarrow.value || preferCollapsed.value)

/** Narrow viewports force the rail. Their toggles do not touch the stored preference. */
function setCollapsed(value: boolean): void {
  if (isNarrow.value) return
  preferCollapsed.value = value
  try {
    localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // Storage can be unavailable in private mode. The session still works.
  }
}

function toggleCollapsed(): void {
  setCollapsed(!collapsed.value)
}

// One source of truth for the sidebar: SidebarTrigger and toggleCollapsed both write here.
const sidebarOpen = computed({
  get: () => !collapsed.value,
  set: (open: boolean) => setCollapsed(!open),
})

defineExpose({ collapsed, toggleCollapsed })
</script>

<template>
  <SidebarProvider v-model:open="sidebarOpen">
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SideNav />
      </SidebarContent>
    </Sidebar>
    <!-- SidebarInset already renders the main landmark. -->
    <SidebarInset>
      <TopBar />
      <div class="px-6 pt-3">
        <AppBreadcrumb />
      </div>
      <div class="flex-1 px-6 pt-4 pb-8">
        <RouterView />
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
