<script setup lang="ts">
/**
 * ProjectSettingsView — General settings for a project.
 *
 * Edit project name/description, delete project.
 *
 * Members and invitations live on their own routes now:
 *   - ProjectMembersView.vue     (/orgs/:orgId/projects/:projectId/members)
 *   - ProjectInvitationsView.vue (/orgs/:orgId/projects/:projectId/invitations)
 *
 * Note: Roles are managed at the org level only, so there is no Roles route here.
 * Permissions are loaded on mount and used to gate edit/delete actions via the
 * `can()` helper from usePermissions.
 */

import { ref, watch, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useForm } from "vee-validate"
import { toTypedSchema } from "@vee-validate/zod"

import { useOrgs } from "@/composables/useOrgs"
import { useProjects } from "@/composables/useProjects"
import { usePermissions } from "@/composables/usePermissions"
import { useAuthStore } from "@/stores/auth"
// Import projects store directly for the updateProject action (not exposed via composable)
import { useProjectsStore } from "@/stores/projects"
import { settingsFormSchema } from "@/schemas/org"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import PageHeader from "@/components/PageHeader.vue"
import { Button } from "@/components/ui/button"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const projectsStore = useProjectsStore()

// Extract orgId and projectId from route params — these scope all operations
const orgId = String(route.params.orgId)
const projectId = String(route.params.projectId)

// ---------------------------------------------------------------------------
// Composable instances
// ---------------------------------------------------------------------------
const orgsComposable = useOrgs()
const projectsComposable = useProjects()
const { can, loadPermissions } = usePermissions()

// Destructure frequently used values for cleaner template bindings
const { fetchOrgById } = orgsComposable
const { currentProject, fetchProjectById, deleteProject } = projectsComposable

// Local loading flag for the save button (separate from store loading)
const saving = ref(false)
const form = useForm({
  validationSchema: toTypedSchema(settingsFormSchema),
  initialValues: { name: "", description: "" },
})

// Fill the form each time the project data arrives.
watch(
  currentProject,
  (project) => {
    if (!project) return
    form.resetForm({ values: { name: project.name, description: project.description ?? "" } })
  },
  { immediate: true },
)

// Saves through the store, because the composable handles modal flows only.
const handleSave = form.handleSubmit(async (values) => {
  saving.value = true
  try {
    await projectsStore.updateProject(orgId, projectId, values)
  } finally {
    saving.value = false
  }
})

/**
 * Delete the project and navigate back to the org's projects list.
 * Called after user confirms via ConfirmDialog.
 */
async function handleDeleteProject(): Promise<void> {
  await deleteProject(orgId, projectId)
  router.push(`/orgs/${orgId}`)
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(async () => {
  await fetchOrgById(orgId)
  await fetchProjectById(orgId, projectId)
  // TODO(ts-migration): this read was unguarded and would have thrown on a null user. `?.` matches
  // the other views. No observable change — `usePermissions` names the parameter `_userId` and
  // discards it.
  loadPermissions(orgId, authStore.currentUser?.id)
})
</script>

<template>
  <div class="w-full">
    <PageHeader title="General" />
    <form
      id="project-settings-form"
      class="max-w-[600px] space-y-4"
      novalidate
      @submit="handleSave"
    >
      <FormField v-slot="{ componentField }" name="name">
        <FormItem>
          <FormLabel>Name</FormLabel>
          <FormControl><Input v-bind="componentField" /></FormControl>
          <FormMessage />
        </FormItem>
      </FormField>
      <FormField v-slot="{ componentField }" name="description">
        <FormItem>
          <FormLabel>Description</FormLabel>
          <FormControl><Textarea v-bind="componentField" rows="3" /></FormControl>
          <FormMessage />
        </FormItem>
      </FormField>
      <div class="flex items-center gap-2">
        <Button v-if="can('project:update')" type="submit" :disabled="saving">
          <Spinner v-if="saving" /> Save
        </Button>
        <ConfirmDialog
          v-if="can('project:delete')"
          title="Delete this project? This cannot be undone."
          confirm-label="Delete"
          destructive
          @confirm="handleDeleteProject"
        >
          <Button type="button" variant="destructive">Delete Project</Button>
        </ConfirmDialog>
      </div>
    </form>
  </div>
</template>
