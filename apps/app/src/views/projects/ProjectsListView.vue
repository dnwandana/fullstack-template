<script setup lang="ts">
/**
 * ProjectsListView — Displays projects belonging to a specific organization.
 *
 * Features:
 *   - Reads orgId from route params to scope all operations
 *   - Fetches the org (for name/title), projects list, and user permissions on mount
 *   - Permission-gated Create Project button
 *   - Skeleton loading state while data is being fetched
 *   - Empty state with a prompt to create the first project
 *   - Responsive card grid matching OrgsListView layout
 *   - ProjectFormModal for creating new projects (scoped to the current org)
 */

import { onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import { Plus } from "@lucide/vue"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import PageHeader from "@/components/PageHeader.vue"
import { useOrgs } from "@/composables/useOrgs"
import { useProjects } from "@/composables/useProjects"
import { usePermissions } from "@/composables/usePermissions"
import { useAuthStore } from "@/stores/auth"
import ProjectFormModal from "@/components/ProjectFormModal.vue"
import type { ProjectInput } from "@/api/projects"

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// Extract orgId from route params — this scopes all project operations
const orgId = String(route.params.orgId)

const { currentOrg, fetchOrgById } = useOrgs()

const {
  projects,
  loading,
  isModalVisible,
  editingProject,
  openCreateModal,
  closeModal,
  handleSubmit,
  fetchProjects,
} = useProjects()

const { can, loadPermissions } = usePermissions()

/**
 * Navigate to the todos list for a specific project within this org.
 */
function viewTodos(projectId: string): void {
  router.push(`/orgs/${orgId}/projects/${projectId}`)
}

/**
 * Wrapper around the projects composable handleSubmit that injects the orgId.
 * The composable expects (orgId, formData) because projects are org-scoped.
 */
async function onSubmit(formData: ProjectInput): Promise<void> {
  await handleSubmit(orgId, formData)
}

// Fetch org details, projects, and permissions in parallel on mount
onMounted(async () => {
  fetchOrgById(orgId)
  fetchProjects(orgId)
  // TODO(ts-migration): this read was unguarded and would have thrown on a null user. `?.` matches
  // the other five views. No observable change — `usePermissions` names the parameter `_userId` and
  // discards it.
  loadPermissions(orgId, authStore.currentUser?.id)
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="currentOrg?.name ?? 'Organization'">
      <Button v-if="can('project:create')" @click="openCreateModal()">
        <Plus /> Create Project
      </Button>
    </PageHeader>

    <!-- Skeleton cards show while the first fetch runs and no projects are cached. -->
    <div
      v-if="loading && projects.length === 0"
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
    >
      <Skeleton v-for="n in 4" :key="n" class="h-36" />
    </div>

    <Empty v-else-if="projects.length === 0">
      <EmptyHeader>
        <EmptyTitle>No projects yet</EmptyTitle>
      </EmptyHeader>
      <EmptyContent v-if="can('project:create')">
        <Button @click="openCreateModal()">Create your first project</Button>
      </EmptyContent>
    </Empty>

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      <Card v-for="project in projects" :key="project.id" class="flex flex-col">
        <CardHeader>
          <CardTitle class="truncate">{{ project.name }}</CardTitle>
          <CardDescription v-if="project.description">{{ project.description }}</CardDescription>
          <CardDescription v-else class="italic">No description</CardDescription>
        </CardHeader>
        <CardFooter class="mt-auto">
          <Button variant="link" class="px-0" @click="viewTodos(project.id)">View Todos</Button>
        </CardFooter>
      </Card>
    </div>

    <ProjectFormModal
      :open="isModalVisible"
      :project="editingProject"
      :loading="loading"
      @submit="onSubmit"
      @cancel="closeModal"
    />
  </div>
</template>
