<script setup lang="ts">
import BrandMark from "./BrandMark.vue"

/** Centers the brand and one card on the muted background, for pages outside the shell. */
withDefaults(defineProps<{ wide?: boolean }>(), { wide: false })
</script>

<template>
  <div
    data-slot="auth-layout"
    class="flex min-h-screen flex-col items-center justify-center bg-muted py-8"
  >
    <BrandMark class="mb-6" />
    <div
      data-slot="auth-card"
      :class="wide ? 'w-[min(460px,calc(100%-32px))]' : 'w-[min(400px,calc(100%-32px))]'"
    >
      <slot />
    </div>
  </div>
</template>
