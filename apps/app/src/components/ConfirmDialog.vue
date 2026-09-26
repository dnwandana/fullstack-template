<script setup lang="ts">
/** Wraps AlertDialog for every destructive action. The trigger goes in the default slot. */
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'

withDefaults(
  defineProps<{
    title: string
    description?: string
    confirmLabel?: string
    destructive?: boolean
    loading?: boolean
  }>(),
  { description: undefined, confirmLabel: 'OK', destructive: false, loading: false },
)

const emit = defineEmits<{ confirm: [] }>()
</script>

<template>
  <AlertDialog>
    <AlertDialogTrigger as-child><slot /></AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ title }}</AlertDialogTitle>
        <AlertDialogDescription v-if="description">{{ description }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          :class="destructive ? buttonVariants({ variant: 'destructive' }) : undefined"
          :disabled="loading"
          @click="emit('confirm')"
          >{{ confirmLabel }}</AlertDialogAction
        >
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
