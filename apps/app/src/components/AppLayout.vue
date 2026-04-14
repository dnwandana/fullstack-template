<script setup>
import { computed, ref, watch, onMounted } from "vue"
import { useRouter, useRoute } from "vue-router"
import { Layout, Button, Space, Typography, Badge, Select } from "ant-design-vue"
import { BellOutlined, LogoutOutlined, UserOutlined } from "@ant-design/icons-vue"
import { useAuthStore } from "@/stores/auth"
import { useOrgsStore } from "@/stores/orgs"
import { useProjectsStore } from "@/stores/projects"
import { useInvitations } from "@/composables/useInvitations"
import AppSidebar from "@/components/AppSidebar.vue"

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const orgsStore = useOrgsStore()
const projectsStore = useProjectsStore()
const { pendingCount, fetchMyInvitations } = useInvitations()

// Sidebar collapse state
const collapsed = ref(false)

// Computed
const currentUser = computed(() => authStore.currentUser)

// Route params as computed for reactivity
const currentOrgId = computed(() => route.params.orgId || null)
const currentProjectId = computed(() => route.params.projectId || null)

// Org selector options
const orgOptions = computed(() =>
  orgsStore.orgs.map((org) => ({
    value: org.id,
    label: org.name,
  })),
)

// Project selector options
const projectOptions = computed(() =>
  projectsStore.projects.map((project) => ({
    value: project.id,
    label: project.name,
  })),
)

// Only show value in selector when it has a matching option (avoids UUID flash on direct URL nav)
const selectedOrgId = computed(() => {
  if (!currentOrgId.value) return null
  return orgOptions.value.some((o) => o.value === currentOrgId.value) ? currentOrgId.value : null
})
const selectedProjectId = computed(() => {
  if (!currentProjectId.value) return null
  return projectOptions.value.some((o) => o.value === currentProjectId.value)
    ? currentProjectId.value
    : null
})

/**
 * Handle org selection change.
 * Navigates to the selected org's projects list and clears project context.
 */
function onOrgChange(orgId) {
  if (orgId) {
    router.push(`/orgs/${orgId}`)
  } else {
    router.push("/orgs")
  }
}

/**
 * Handle project selection change.
 * Navigates to the selected project's todos list within the current org.
 */
function onProjectChange(projectId) {
  if (projectId && currentOrgId.value) {
    router.push(`/orgs/${currentOrgId.value}/projects/${projectId}`)
  } else if (currentOrgId.value) {
    router.push(`/orgs/${currentOrgId.value}`)
  }
}

// Fetch orgs list on mount for the org selector
onMounted(() => {
  if (authStore.isAuthenticated) {
    orgsStore.fetchOrgs()
    fetchMyInvitations()
  }
})

// When orgId changes, fetch projects for the new org
watch(
  currentOrgId,
  (newOrgId) => {
    if (newOrgId) {
      projectsStore.fetchProjects(newOrgId)
    } else {
      projectsStore.clearProjects()
    }
  },
  { immediate: true },
)

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
      <!-- Left side: Logo + Org/Project selectors -->
      <div style="display: flex; align-items: center; gap: 12px">
        <Typography.Title
          :level="4"
          style="color: white; margin: 0; cursor: pointer; white-space: nowrap"
          @click="navigateTo('/orgs')"
        >
          Todo App
        </Typography.Title>

        <!-- Org selector — always visible -->
        <Select
          :value="selectedOrgId"
          :options="orgOptions"
          placeholder="Select organization"
          style="min-width: 180px"
          :bordered="false"
          allow-clear
          @change="onOrgChange"
          class="header-select"
        />

        <!-- Project selector — visible only when an org is selected -->
        <Select
          v-if="currentOrgId"
          :value="selectedProjectId"
          :options="projectOptions"
          placeholder="Select project"
          style="min-width: 180px"
          :bordered="false"
          allow-clear
          @change="onProjectChange"
          class="header-select"
        />
      </div>

      <!-- Right side: Invitations + User + Logout -->
      <Space :size="16">
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

    <!-- Body: Sidebar + Content -->
    <Layout>
      <!-- Sidebar -->
      <Layout.Sider
        v-model:collapsed="collapsed"
        collapsible
        :width="200"
        :collapsed-width="64"
        theme="light"
        style="background: #fff"
      >
        <AppSidebar />
      </Layout.Sider>

      <!-- Content + Footer -->
      <Layout>
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

        <Layout.Footer style="text-align: center">
          Todo App ©{{ new Date().getFullYear() }}
        </Layout.Footer>
      </Layout>
    </Layout>
  </Layout>
</template>

<style scoped>
/* Style the header selects to match the dark theme */
:deep(.header-select .ant-select-selector) {
  background: transparent !important;
  color: white !important;
  border-color: rgba(255, 255, 255, 0.3) !important;
}

:deep(.header-select .ant-select-selection-item) {
  color: white !important;
}

:deep(.header-select .ant-select-selection-placeholder) {
  color: rgba(255, 255, 255, 0.5) !important;
}

:deep(.header-select .ant-select-arrow) {
  color: rgba(255, 255, 255, 0.5) !important;
}

:deep(.header-select .ant-select-clear) {
  background: transparent !important;
  color: rgba(255, 255, 255, 0.5) !important;
}
</style>
