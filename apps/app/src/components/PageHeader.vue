<script setup lang="ts">
/** PageHeader renders the title row of a view. Action buttons go in the default slot. */
import { Spinner } from "@/components/ui/spinner"

withDefaults(defineProps<{ title: string; description?: string; loading?: boolean }>(), {
  description: undefined,
  loading: false,
})
</script>

<template>
  <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div class="min-w-0">
      <div class="flex items-center gap-2">
        <h1 class="text-xl font-semibold tracking-tight">{{ title }}</h1>
        <Spinner v-if="loading" data-slot="page-spinner" class="size-4 text-muted-foreground" />
      </div>
      <p v-if="description" class="mt-1 text-sm text-muted-foreground">{{ description }}</p>
    </div>
    <div data-slot="page-actions" class="flex flex-wrap items-center gap-2"><slot /></div>
  </div>
</template>
