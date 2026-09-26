<script setup lang="ts">
/**
 * TopBar — 56px header.
 *
 * Composition only, with one piece of logic: the "/" between the switchers has
 * to disappear with ProjectSwitcher, which hides itself when no project is
 * selected. Both test the same condition, from opposite sides.
 */

import { computed } from "vue"
import { RouterLink } from "vue-router"
import { LayoutGrid } from "@lucide/vue"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useTenantStore } from "@/stores/tenant"
import OrgSwitcher from "./OrgSwitcher.vue"
import ProjectSwitcher from "./ProjectSwitcher.vue"
import InvitationsBell from "./InvitationsBell.vue"
import UserMenu from "./UserMenu.vue"

const tenant = useTenantStore()

// The id, not the object: on a deep link the id is present from the first
// render while the project is still being fetched.
const hasProject = computed(() => Boolean(tenant.currentProjectId))
</script>

<template>
  <header class="flex h-14 items-center gap-2 border-b px-4">
    <SidebarTrigger />
    <Separator orientation="vertical" class="mx-1 h-6" />

    <!-- The only way back to /orgs from inside an org: SideNav starts at
         Projects and AppBreadcrumb roots at the org, so without this,
         leaving an org means the browser back button or the URL bar. -->
    <RouterLink :to="{ name: 'OrgsList' }" class="top-bar__brand" aria-label="Organizations">
      <Button variant="ghost" size="icon" as="span"><LayoutGrid class="size-5" /></Button>
    </RouterLink>
    <OrgSwitcher />
    <span v-if="hasProject" class="top-bar__sep text-muted-foreground" aria-hidden="true">/</span>
    <ProjectSwitcher />

    <div class="ml-auto flex items-center gap-1">
      <InvitationsBell />
      <UserMenu />
    </div>
  </header>
</template>
