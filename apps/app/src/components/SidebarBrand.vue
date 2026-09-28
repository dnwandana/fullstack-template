<script setup lang="ts">
/** Shows the brand at the top of the sidebar. The rail has room for the square only. */
import { computed } from "vue"
import { SidebarHeader, useSidebar } from "@/components/ui/sidebar"
import BrandMark from "./BrandMark.vue"

const { state, isMobile } = useSidebar()

// The mobile sheet is always full width, so it always shows the full mark.
const compact = computed(() => state.value === "collapsed" && !isMobile.value)
</script>

<template>
  <SidebarHeader
    data-slot="sidebar-brand"
    class="h-14 flex-row items-center border-b px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
  >
    <BrandMark :compact="compact" />
  </SidebarHeader>
</template>
