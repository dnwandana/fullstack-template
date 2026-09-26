<script setup lang="ts">
/**
 * OrgsListView — Displays the current user's organizations in a responsive card grid.
 *
 * Features:
 *   - Fetches all orgs on mount via the useOrgs composable
 *   - Skeleton loading state while data is being fetched
 *   - Empty state with a prompt to create the first organization
 *   - Card grid with responsive breakpoints (1, 2, 3 and 4 columns)
 *   - Each card shows the org name, description, and a "View Projects" link
 *   - OrgFormModal for creating new organizations
 */

import { onMounted } from "vue"
import { useRouter } from "vue-router"
import { Plus } from "@lucide/vue"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import PageHeader from "@/components/PageHeader.vue"
import { useOrgs } from "@/composables/useOrgs"
import OrgFormModal from "@/components/OrgFormModal.vue"

const router = useRouter()

const {
  orgs,
  loading,
  isModalVisible,
  editingOrg,
  openCreateModal,
  closeModal,
  handleSubmit,
  fetchOrgs,
} = useOrgs()

/**
 * Navigate to the projects list for a given organization.
 */
function viewProjects(orgId: string): void {
  router.push(`/orgs/${orgId}`)
}

// Fetch all organizations when the component mounts
onMounted(() => {
  fetchOrgs()
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="My Organizations">
      <Button @click="openCreateModal()"><Plus /> Create Organization</Button>
    </PageHeader>

    <!-- Skeleton cards show while the first fetch runs and no orgs are cached. -->
    <div
      v-if="loading && orgs.length === 0"
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
    >
      <Skeleton v-for="n in 4" :key="n" class="h-36" />
    </div>

    <Empty v-else-if="orgs.length === 0">
      <EmptyHeader>
        <EmptyTitle>No organizations yet</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button @click="openCreateModal()">Create your first organization</Button>
      </EmptyContent>
    </Empty>

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      <Card v-for="org in orgs" :key="org.id" class="flex flex-col">
        <CardHeader>
          <CardTitle class="truncate">{{ org.name }}</CardTitle>
          <CardDescription v-if="org.description">{{ org.description }}</CardDescription>
          <CardDescription v-else class="italic">No description</CardDescription>
        </CardHeader>
        <CardFooter class="mt-auto">
          <Button variant="link" class="px-0" @click="viewProjects(org.id)">View Projects</Button>
        </CardFooter>
      </Card>
    </div>

    <OrgFormModal
      :open="isModalVisible"
      :org="editingOrg"
      :loading="loading"
      @submit="handleSubmit"
      @cancel="closeModal"
    />
  </div>
</template>
