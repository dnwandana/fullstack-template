<script lang="ts">
/** Describes one skeleton cell. `width` is the bar width in pixels. */
export interface SkeletonColumn {
  width?: number
  avatar?: "circle" | "square"
  align?: "end"
}
</script>

<script setup lang="ts">
/** Renders placeholder rows while a table loads for the first time. */
import { Skeleton } from "@/components/ui/skeleton"
import { TableCell, TableRow } from "@/components/ui/table"

withDefaults(defineProps<{ rows?: number; columns: SkeletonColumn[] }>(), { rows: 5 })
</script>

<template>
  <TableRow v-for="row in rows" :key="row" data-slot="skeleton-row" class="hover:bg-transparent">
    <TableCell v-for="(column, index) in columns" :key="index">
      <div :class="['flex items-center gap-2', column.align === 'end' && 'justify-end']">
        <Skeleton
          v-if="column.avatar"
          :class="column.avatar === 'circle' ? 'size-7 rounded-full' : 'size-6 rounded-md'"
        />
        <Skeleton
          data-slot="skeleton-bar"
          class="h-4"
          :style="{ width: `${column.width ?? 96}px` }"
        />
      </div>
    </TableCell>
  </TableRow>
</template>
