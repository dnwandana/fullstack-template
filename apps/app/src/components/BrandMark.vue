<script setup lang="ts">
/** Renders the product mark. The sidebar rail and small screens use the compact square. */
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
</script>

<template>
  <span data-slot="brand-mark" class="inline-flex items-center gap-2">
    <span
      data-slot="brand-square"
      class="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground"
      >FT</span
    >
    <span v-if="!compact" class="text-[15px] font-semibold tracking-[-0.015em] whitespace-nowrap"
      >Fullstack Template</span
    >
  </span>
</template>
