<script setup>
import { computed, onMounted } from "vue"
import { useRouter, useRoute } from "vue-router"
import { Layout, Breadcrumb, Button, Space, Typography, Badge } from "ant-design-vue"
import { SettingOutlined, BellOutlined, LogoutOutlined, UserOutlined } from "@ant-design/icons-vue"
import { useAuthStore } from "@/stores/auth"
import { useOrgsStore } from "@/stores/orgs"
import { useProjectsStore } from "@/stores/projects"
import { useInvitations } from "@/composables/useInvitations"

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const orgsStore = useOrgsStore()
const projectsStore = useProjectsStore()
const { pendingCount, fetchMyInvitations } = useInvitations()

// Computed
const currentUser = computed(() => authStore.currentUser)

// Fetch pending invitations count on mount (only if authenticated)
onMounted(() => {
  if (authStore.isAuthenticated) {
    fetchMyInvitations()
  }
})

/**
 * Build breadcrumb items based on current route.
 * Each item has a label for display and an optional path for navigation.
 * The last item in the list is rendered as plain text (no link).
 * @returns {Array<{label: string, path: string|null}>}
 */
const breadcrumbItems = computed(() => {
  const items = []
  const params = route.params

  // Always show "Organizations" as first crumb when inside org-related pages
  if (route.path.startsWith("/orgs") || route.path === "/invitations") {
    items.push({ label: "Organizations", path: "/orgs" })
  }

  // Add org name if we're in an org context
  if (params.orgId) {
    const orgName = orgsStore.currentOrg?.name || "..."
    items.push({ label: orgName, path: `/orgs/${params.orgId}` })
  }

  // Add project name if we're in a project context
  if (params.projectId) {
    const projectName = projectsStore.currentProject?.name || "..."
    items.push({
      label: projectName,
      path: `/orgs/${params.orgId}/projects/${params.projectId}`,
    })
  }

  // Add page-specific trailing segment (no link — it's the current page)
  if (route.name === "TodoDetail") {
    items.push({ label: "Todo Detail", path: null })
  } else if (route.name === "OrgSettings") {
    items.push({ label: "Settings", path: null })
  } else if (route.name === "ProjectSettings") {
    items.push({ label: "Settings", path: null })
  } else if (route.name === "MyInvitations") {
    // Invitations page stands alone — replace all prior items
    return [{ label: "My Invitations", path: null }]
  }

  return items
})

/**
 * Navigate to the appropriate settings page based on current context.
 * If inside a project, go to project settings; otherwise org settings.
 */
function goToSettings() {
  const params = route.params
  if (params.projectId) {
    router.push(`/orgs/${params.orgId}/projects/${params.projectId}/settings`)
  } else if (params.orgId) {
    router.push(`/orgs/${params.orgId}/settings`)
  }
}

/**
 * Whether settings gear should be shown.
 * Visible when inside an org or project context, but hidden on settings pages themselves.
 */
const showSettingsGear = computed(() => {
  const params = route.params
  const isSettingsPage = route.name === "OrgSettings" || route.name === "ProjectSettings"
  // Don't show gear if already on a settings page
  if (isSettingsPage) return false
  // Show gear when we have an org context
  if (params.orgId) return true
  return false
})

// Handle logout
function handleLogout() {
  authStore.logout()
  router.push("/login")
}

// Navigation helper
function navigateTo(path) {
  router.push(path)
}
</script>

<template>
  <Layout style="min-height: 100vh">
    <!-- Header -->
    <Layout.Header
      style="display: flex; align-items: center; justify-content: space-between; padding: 0 24px"
    >
      <!-- Left side: Logo + Breadcrumb -->
      <div style="display: flex; align-items: center; gap: 16px">
        <Typography.Title
          :level="4"
          style="color: white; margin: 0; cursor: pointer; white-space: nowrap"
          @click="navigateTo('/orgs')"
        >
          Todo App
        </Typography.Title>

        <!-- Dynamic breadcrumb built from route context -->
        <Breadcrumb style="margin: 0">
          <Breadcrumb.Item v-for="(item, index) in breadcrumbItems" :key="index">
            <!-- Render a link for all items except the last one -->
            <router-link
              v-if="item.path && index < breadcrumbItems.length - 1"
              :to="item.path"
              style="color: rgba(255, 255, 255, 0.65)"
            >
              {{ item.label }}
            </router-link>
            <span v-else style="color: rgba(255, 255, 255, 0.85)">{{ item.label }}</span>
          </Breadcrumb.Item>
        </Breadcrumb>
      </div>

      <!-- Right side: Settings + Invitations + User -->
      <Space :size="16">
        <!-- Settings gear — only shown in org/project context, not on settings pages -->
        <Button v-if="showSettingsGear" type="text" @click="goToSettings" style="color: white">
          <template #icon><SettingOutlined /></template>
        </Button>

        <!-- Invitations badge — shows pending count -->
        <Badge :count="pendingCount" :offset="[-5, 5]">
          <Button type="text" @click="navigateTo('/invitations')" style="color: white">
            <template #icon><BellOutlined /></template>
          </Button>
        </Badge>

        <!-- User info -->
        <Space>
          <UserOutlined style="color: white" />
          <Typography.Text style="color: white">
            {{ currentUser?.username }}
          </Typography.Text>
        </Space>

        <!-- Logout -->
        <Button type="text" @click="handleLogout" style="color: white">
          <template #icon>
            <LogoutOutlined />
          </template>
          Logout
        </Button>
      </Space>
    </Layout.Header>

    <!-- Content -->
    <Layout.Content style="padding: 24px; background: #f5f5f5">
      <div
        style="
          background: white;
          padding: 24px;
          min-height: calc(100vh - 64px - 70px - 48px);
          border-radius: 8px;
        "
      >
        <slot></slot>
      </div>
    </Layout.Content>

    <!-- Footer -->
    <Layout.Footer style="text-align: center">
      Todo App ©{{ new Date().getFullYear() }}
    </Layout.Footer>
  </Layout>
</template>
