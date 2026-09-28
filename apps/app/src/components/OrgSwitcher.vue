<script setup lang="ts">
/**
 * OrgSwitcher — top-bar organization dropdown.
 *
 * Member counts and role tags are not in GET /api/orgs; they come from
 * GET /orgs/:orgId/members, one request per org. Those fire on FIRST OPEN, not
 * on mount, and the dropdown renders a skeleton for each org while they land.
 */

import { ref, computed } from "vue"
import { useRouter } from "vue-router"
import { Check, ChevronsUpDown } from "@lucide/vue"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useTenantStore } from "@/stores/tenant"
import type { OrgMeta } from "@/stores/tenant"
import { useOrgsStore } from "@/stores/orgs"
import { formatMemberCount } from "@/utils/format"
import UserAvatar from "./UserAvatar.vue"

const router = useRouter()
const tenant = useTenantStore()
const orgsStore = useOrgsStore()

const open = ref(false)
const requested = ref(false)

const currentOrg = computed(() => tenant.currentOrg)
const orgs = computed(() => orgsStore.orgs)
const hasProject = computed(() => Boolean(tenant.currentProjectId))

/** Cached metadata for one org, or null while the request is in flight. */
function metaFor(orgId: string): OrgMeta | null {
  return tenant.orgMeta[orgId] ?? null
}

/**
 * Kick off metadata loading the first time the dropdown opens.
 * Deliberately not awaited — the menu must paint immediately.
 */
async function onOpenChange(isOpen: boolean): Promise<void> {
  open.value = isOpen
  if (isOpen && !requested.value) {
    requested.value = true
    await tenant.loadAllOrgMeta()
  }
}

function selectOrg(orgId: string): void {
  open.value = false
  if (orgId !== tenant.currentOrgId) {
    router.push({ name: "ProjectsList", params: { orgId } })
  }
}

defineExpose({ metaFor, onOpenChange, selectOrg })
</script>

<template>
  <DropdownMenu v-if="currentOrg" :open="open" @update:open="onOpenChange">
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        class="org-switcher gap-2 px-2"
        :aria-label="`Organization: ${currentOrg.name}`"
      >
        <UserAvatar :name="currentOrg.name" :size="20" shape="square" />
        <span
          data-slot="org-name"
          :class="[
            'max-w-[120px] truncate font-medium md:max-w-[160px]',
            hasProject && 'hidden md:inline',
          ]"
          >{{ currentOrg.name }}</span
        >
        <ChevronsUpDown class="size-4 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent data-slot="org-menu" align="start" class="w-[300px]">
      <DropdownMenuLabel>Organizations</DropdownMenuLabel>
      <DropdownMenuItem
        v-for="org in orgs"
        :key="org.id"
        data-slot="org-item"
        :data-current="org.id === currentOrg.id"
        class="justify-between gap-3"
        @select="selectOrg(org.id)"
      >
        <span
          :class="['flex min-w-0 items-center gap-2', org.id === currentOrg.id && 'font-medium']"
        >
          <Check v-if="org.id === currentOrg.id" class="size-4 shrink-0" />
          <span v-else class="size-4 shrink-0" aria-hidden="true" />
          <span class="truncate">{{ org.name }}</span>
        </span>
        <!-- The meta arrives after the menu paints. The skeleton holds the space. -->
        <span
          v-if="metaFor(org.id)"
          data-slot="org-meta"
          class="flex shrink-0 items-center gap-2 text-xs text-muted-foreground"
        >
          <template v-if="metaFor(org.id)?.failed">-</template>
          <template v-else>
            {{ formatMemberCount(metaFor(org.id)?.memberCount ?? 0) }}
            <Badge v-if="metaFor(org.id)?.roleName" variant="secondary">
              {{ metaFor(org.id)?.roleName }}
            </Badge>
          </template>
        </span>
        <Skeleton v-else class="h-3.5 w-20" />
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
