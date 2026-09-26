<script setup lang="ts">
/** PageHeader renders the title row of a view. Action buttons go in the default slot. */
withDefaults(defineProps<{ title: string; description?: string }>(), { description: undefined })
</script>

<template>
  <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 class="text-xl font-semibold tracking-tight">{{ title }}</h1>
      <p v-if="description" class="mt-1 text-sm text-muted-foreground">{{ description }}</p>
    </div>
    <div class="flex items-center gap-2"><slot /></div>
  </div>
</template>
