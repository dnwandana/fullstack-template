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
import { ChevronDown } from "@lucide/vue"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useTenantStore } from "@/stores/tenant"
import type { OrgMeta } from "@/stores/tenant"
import { useOrgsStore } from "@/stores/orgs"

const router = useRouter()
const tenant = useTenantStore()
const orgsStore = useOrgsStore()

const open = ref(false)
const requested = ref(false)

const currentOrg = computed(() => tenant.currentOrg)
const orgs = computed(() => orgsStore.orgs)

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
      <Button variant="ghost" class="org-switcher gap-2 px-2">
        <Avatar class="size-6">
          <AvatarFallback class="text-xs">{{ currentOrg.name.charAt(0) }}</AvatarFallback>
        </Avatar>
        <span class="max-w-[160px] truncate font-medium">{{ currentOrg.name }}</span>
        <ChevronDown class="size-4 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-64">
      <DropdownMenuLabel>Organizations</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        v-for="org in orgs"
        :key="org.id"
        class="flex items-start justify-between gap-3"
        @select="selectOrg(org.id)"
      >
        <span class="truncate">{{ org.name }}</span>
        <!-- Metadata arrives after the menu paints; hold the space. -->
        <span v-if="metaFor(org.id)" class="flex items-center gap-2 text-xs text-muted-foreground">
          {{ metaFor(org.id)?.memberCount }} members
          <Badge v-if="metaFor(org.id)?.roleName" variant="secondary">
            {{ metaFor(org.id)?.roleName }}
          </Badge>
        </span>
        <Skeleton v-else class="h-4 w-20" />
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
