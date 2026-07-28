<script setup lang="ts">
/**
 * ProjectSwitcher — top-bar project dropdown (artboard 05).
 *
 * No avatar mark and no metadata sub-lines: the project is subordinate to the
 * org in the trail, and GET /orgs/:orgId/projects already returns everything
 * the list needs. Hidden entirely when no project is selected.
 */

import { ref, computed, watch } from "vue"
import { useRouter } from "vue-router"
import { Dropdown, Menu } from "ant-design-vue"
import { DownOutlined } from "@ant-design/icons-vue"
import { useTenantStore } from "@/stores/tenant"
import { useProjectsStore } from "@/stores/projects"

const router = useRouter()
const tenant = useTenantStore()
const projectsStore = useProjectsStore()

const open = ref(false)

const currentProject = computed(() => tenant.currentProject)
const projects = computed(() => projectsStore.projects)

// The shell stays mounted across org changes, so this cannot be an onMounted
// fetch — the project list has to follow the org param.
watch(
  () => tenant.currentOrgId,
  (orgId) => {
    if (orgId) projectsStore.fetchProjects(orgId)
  },
  { immediate: true },
)

function selectProject(projectId: string): void {
  open.value = false
  if (projectId === tenant.currentProjectId) return
  router.push({
    name: "TodosList",
    params: { orgId: tenant.currentOrgId, projectId },
  })
}

defineExpose({ selectProject })
</script>

<template>
  <Dropdown v-if="currentProject" v-model:open="open" trigger="click">
    <button type="button" class="project-switcher">
      <span class="project-switcher__name">{{ currentProject.name }}</span>
      <DownOutlined />
    </button>

    <template #overlay>
      <Menu
        :selected-keys="tenant.currentProjectId ? [tenant.currentProjectId] : []"
        @click="({ key }) => selectProject(String(key))"
      >
        <Menu.Item v-for="project in projects" :key="project.id">
          {{ project.name }}
        </Menu.Item>
      </Menu>
    </template>
  </Dropdown>
</template>

<style scoped>
.project-switcher {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  font: inherit;
  color: var(--text-primary);
}

.project-switcher__name {
  font-weight: 600;
}

.project-switcher:hover {
  background: var(--gray-100);
}
</style>
