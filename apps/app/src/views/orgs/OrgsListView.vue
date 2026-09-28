<script setup lang="ts">
/**
 * OrgsListView — Displays the current user's organizations in a table.
 *
 * Features:
 *   - Fetches all orgs on mount via the useOrgs composable
 *   - Skeleton rows while the first fetch runs
 *   - Empty state with a prompt to create the first organization
 *   - A table with one clickable row per org
 *   - Each row shows the org name, description, and a "View Projects" link
 *   - OrgFormModal for creating new organizations
 */

import { onMounted } from "vue"
import { useRouter } from "vue-router"
import { ArrowRight, Building2, Plus } from "@lucide/vue"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
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
import UserAvatar from "@/components/UserAvatar.vue"
import { useOrgs } from "@/composables/useOrgs"
import OrgFormModal from "@/components/OrgFormModal.vue"
import { useTenantStore } from "@/stores/tenant"
import { formatMemberCount } from "@/utils/format"

const router = useRouter()
const tenant = useTenantStore()

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

/**
 * Opens the org from a row click or Enter. The "View Projects" link navigates by itself, so an
 * event from inside the link is ignored here.
 */
function openFromRow(event: Event, orgId: string): void {
  if (event.target instanceof Element && event.target.closest("a")) return
  viewProjects(orgId)
}

// The meta requests run in parallel after the list arrives. A failed org gets `failed: true`
// from the store, so one bad org never blocks the others.
onMounted(async () => {
  await fetchOrgs()
  void tenant.loadAllOrgMeta()
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="My Organizations" :loading="loading && orgs.length > 0">
      <Button @click="openCreateModal()"><Plus /> Create Organization</Button>
    </PageHeader>

    <Empty v-if="!loading && orgs.length === 0">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Building2 /></EmptyMedia>
        <EmptyTitle>No organizations yet</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button @click="openCreateModal()"><Plus /> Create your first organization</Button>
      </EmptyContent>
    </Empty>

    <Table v-else>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Description</TableHead>
          <TableHead class="w-[120px]">Members</TableHead>
          <TableHead class="w-[110px]">Your role</TableHead>
          <TableHead class="w-[1%] text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableSkeletonRows
          v-if="loading && orgs.length === 0"
          :rows="4"
          :columns="[
            { avatar: 'square', width: 140 },
            { width: 240 },
            { width: 72 },
            { width: 56 },
            { width: 110, align: 'end' },
          ]"
        />
        <TableRow
          v-for="org in orgs"
          :key="org.id"
          data-slot="org-row"
          tabindex="0"
          class="cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-none"
          @click="openFromRow($event, org.id)"
          @keydown.enter="openFromRow($event, org.id)"
        >
          <TableCell class="max-w-[320px]">
            <div class="flex min-w-0 items-center gap-2.5">
              <UserAvatar :name="org.name" :size="24" shape="square" />
              <span class="truncate font-medium" :title="org.name">{{ org.name }}</span>
            </div>
          </TableCell>
          <TableCell
            data-slot="org-desc"
            :class="['max-w-[320px] truncate text-muted-foreground', !org.description && 'italic']"
            >{{ org.description || "No description" }}</TableCell
          >
          <TableCell data-slot="org-members" class="whitespace-nowrap tabular-nums">
            <Skeleton v-if="!tenant.orgMeta[org.id]" class="h-3.5 w-[72px]" />
            <template v-else-if="tenant.orgMeta[org.id]?.failed">-</template>
            <template v-else>{{
              formatMemberCount(tenant.orgMeta[org.id]?.memberCount ?? 0)
            }}</template>
          </TableCell>
          <TableCell data-slot="org-role">
            <Skeleton v-if="!tenant.orgMeta[org.id]" class="h-5 w-14" />
            <Badge v-else-if="tenant.orgMeta[org.id]?.roleName" variant="secondary">{{
              tenant.orgMeta[org.id]?.roleName
            }}</Badge>
            <template v-else>-</template>
          </TableCell>
          <TableCell class="w-[1%] text-right">
            <RouterLink
              :to="`/orgs/${org.id}`"
              class="inline-flex items-center gap-1 font-medium whitespace-nowrap text-link hover:underline"
            >
              View Projects<ArrowRight class="size-3.5" />
            </RouterLink>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>

    <OrgFormModal
      :open="isModalVisible"
      :org="editingOrg"
      :loading="loading"
      @submit="handleSubmit"
      @cancel="closeModal"
    />
  </div>
</template>
