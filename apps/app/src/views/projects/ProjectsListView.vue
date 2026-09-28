<script setup lang="ts">
/**
 * ProjectsListView — Displays projects belonging to a specific organization.
 *
 * Features:
 *   - Reads orgId from route params to scope all operations
 *   - Fetches the org (for name/title), projects list, and user permissions on mount
 *   - Permission-gated Create Project button
 *   - Skeleton rows while the first fetch runs
 *   - Empty state with a prompt to create the first project
 *   - A table with one clickable row per project
 *   - ProjectFormModal for creating new projects (scoped to the current org)
 */

import { onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import { ArrowRight, FolderKanban, Plus } from "@lucide/vue"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import PageHeader from "@/components/PageHeader.vue"
import TableSkeletonRows from "@/components/TableSkeletonRows.vue"
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
 * Opens the todos from a row click or Enter. The "View Todos" link navigates by itself, so an
 * event from inside the link is ignored here.
 */
function openFromRow(event: Event, projectId: string): void {
  if (event.target instanceof Element && event.target.closest("a")) return
  viewTodos(projectId)
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
    <PageHeader
      :title="currentOrg?.name ?? 'Organization'"
      :loading="loading && projects.length > 0"
    >
      <Button v-if="can('project:create')" @click="openCreateModal()">
        <Plus /> Create Project
      </Button>
    </PageHeader>

    <Empty v-if="!loading && projects.length === 0">
      <EmptyHeader>
        <EmptyMedia variant="icon"><FolderKanban /></EmptyMedia>
        <EmptyTitle>No projects yet</EmptyTitle>
      </EmptyHeader>
      <EmptyContent v-if="can('project:create')">
        <Button @click="openCreateModal()"><Plus /> Create your first project</Button>
      </EmptyContent>
    </Empty>

    <Table v-else>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Description</TableHead>
          <TableHead class="w-[1%] text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableSkeletonRows
          v-if="loading && projects.length === 0"
          :rows="4"
          :columns="[{ width: 150 }, { width: 260 }, { width: 90, align: 'end' }]"
        />
        <TableRow
          v-for="project in projects"
          :key="project.id"
          data-slot="project-row"
          tabindex="0"
          class="cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-none"
          @click="openFromRow($event, project.id)"
          @keydown.enter="openFromRow($event, project.id)"
        >
          <TableCell class="max-w-[280px] truncate font-medium" :title="project.name">{{
            project.name
          }}</TableCell>
          <TableCell
            data-slot="project-desc"
            :class="[
              'max-w-[420px] truncate text-muted-foreground',
              !project.description && 'italic',
            ]"
            >{{ project.description || "No description" }}</TableCell
          >
          <TableCell class="w-[1%] text-right">
            <RouterLink
              :to="`/orgs/${orgId}/projects/${project.id}`"
              class="inline-flex items-center gap-1 font-medium whitespace-nowrap text-link hover:underline"
            >
              View Todos<ArrowRight class="size-3.5" />
            </RouterLink>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>

    <ProjectFormModal
      :open="isModalVisible"
      :project="editingProject"
      :loading="loading"
      @submit="onSubmit"
      @cancel="closeModal"
    />
  </div>
</template>
