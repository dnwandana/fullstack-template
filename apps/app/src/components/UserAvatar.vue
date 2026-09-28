<script setup lang="ts">
/** Renders the first letter of a name. The name itself always shows beside it. */
import { computed } from "vue"
import { cn } from "@/lib/utils"

const props = withDefaults(
  defineProps<{
    name: string | null | undefined
    size?: 20 | 22 | 24 | 28 | 40
    shape?: "circle" | "square"
  }>(),
  { size: 28, shape: "circle" },
)

const SIZES: Record<20 | 22 | 24 | 28 | 40, string> = {
  20: "size-5 text-[10px]",
  22: "size-[22px] text-[10px]",
  24: "size-6 text-[11px]",
  28: "size-7 text-xs",
  40: "size-10 text-base",
}

const initial = computed(() => props.name?.trim().charAt(0).toUpperCase() || "?")

const classes = computed(() =>
  cn(
    "inline-flex shrink-0 items-center justify-center font-semibold select-none",
    SIZES[props.size],
    props.shape === "square"
      ? "rounded-md bg-primary text-primary-foreground"
      : "rounded-full bg-muted text-foreground",
  ),
)
</script>

<template>
  <span data-slot="user-avatar" aria-hidden="true" :class="classes">{{ initial }}</span>
</template>
