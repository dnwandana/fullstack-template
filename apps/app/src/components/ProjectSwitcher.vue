<script setup lang="ts">
/**
 * ProjectSwitcher — top-bar project dropdown.
 *
 * No avatar mark and no metadata sub-lines: the project is subordinate to the
 * org in the trail, and GET /orgs/:orgId/projects already returns everything
 * the list needs. Hidden entirely when no project is selected.
 */

import { computed, watch } from "vue"
import { useRouter } from "vue-router"
import { Check, ChevronsUpDown } from "@lucide/vue"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTenantStore } from "@/stores/tenant"
import { useProjectsStore } from "@/stores/projects"

const router = useRouter()
const tenant = useTenantStore()
const projectsStore = useProjectsStore()

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
  if (projectId === tenant.currentProjectId) return
  router.push({
    name: "TodosList",
    params: { orgId: tenant.currentOrgId, projectId },
  })
}

defineExpose({ selectProject })
</script>

<template>
  <DropdownMenu v-if="currentProject">
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="sm" class="project-switcher gap-2 px-2">
        <span data-slot="project-name" class="max-w-[88px] truncate font-medium md:max-w-[160px]">{{
          currentProject.name
        }}</span>
        <ChevronsUpDown class="size-4 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent data-slot="project-menu" align="start" class="w-[240px]">
      <DropdownMenuLabel>Projects</DropdownMenuLabel>
      <DropdownMenuItem
        v-for="project in projects"
        :key="project.id"
        data-slot="project-item"
        :data-current="project.id === currentProject.id"
        :class="project.id === currentProject.id && 'font-medium'"
        @select="selectProject(project.id)"
      >
        <Check v-if="project.id === currentProject.id" />
        <span v-else class="size-4 shrink-0" aria-hidden="true" />
        <span class="truncate">{{ project.name }}</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
