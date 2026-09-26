<script setup lang="ts">
/**
 * OrgSettingsView — General settings for an organization (name, description, delete).
 *
 * Members, roles, and invitations now live on their own routes/views:
 * `OrgMembersView`, `OrgRolesView`, and `OrgInvitationsView`.
 */

import { ref, watch, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useForm } from "vee-validate"
import { toTypedSchema } from "@vee-validate/zod"

import { useOrgs } from "@/composables/useOrgs"
import { usePermissions } from "@/composables/usePermissions"
import { useAuthStore } from "@/stores/auth"
// Import orgs store directly for the updateOrg action (not exposed via composable)
import { useOrgsStore } from "@/stores/orgs"
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
const orgsStore = useOrgsStore()

// Extract orgId from route params — this scopes all settings operations
const orgId = String(route.params.orgId)

const { currentOrg, fetchOrgById, deleteOrg } = useOrgs()
const { can, loadPermissions } = usePermissions()

// Local loading flag for the save button (separate from store loading)
const saving = ref(false)
const form = useForm({
  validationSchema: toTypedSchema(settingsFormSchema),
  initialValues: { name: "", description: "" },
})

// Fill the form each time the org data arrives.
watch(
  currentOrg,
  (org) => {
    if (org) form.resetForm({ values: { name: org.name, description: org.description ?? "" } })
  },
  { immediate: true },
)

// Saves through the store, because the composable handles modal flows only.
const handleSave = form.handleSubmit(async (values) => {
  saving.value = true
  try {
    await orgsStore.updateOrg(orgId, values)
  } finally {
    saving.value = false
  }
})

/**
 * Delete the organization and navigate back to the orgs list.
 * Called after user confirms via ConfirmDialog.
 */
async function handleDeleteOrg(): Promise<void> {
  await deleteOrg(orgId)
  router.push("/orgs")
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(async () => {
  await fetchOrgById(orgId)
  // TODO(ts-migration): this read was unguarded and would have thrown on a null user. `?.` matches
  // the other views. No observable change — `usePermissions` names the parameter `_userId` and
  // discards it.
  loadPermissions(orgId, authStore.currentUser?.id)
})
</script>

<template>
  <div class="w-full">
    <PageHeader title="General" />
    <form id="org-settings-form" class="max-w-[600px] space-y-4" novalidate @submit="handleSave">
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
        <Button v-if="can('org:update')" type="submit" :disabled="saving">
          <Spinner v-if="saving" /> Save
        </Button>
        <ConfirmDialog
          v-if="can('org:delete')"
          title="Delete this organization? This cannot be undone."
          confirm-label="Delete"
          destructive
          @confirm="handleDeleteOrg"
        >
          <Button type="button" variant="destructive">Delete Organization</Button>
        </ConfirmDialog>
      </div>
    </form>
  </div>
</template>
