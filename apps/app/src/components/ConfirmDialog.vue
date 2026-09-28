<script setup lang="ts">
/** Wraps AlertDialog for every destructive action. The trigger goes in the default slot. */
import { ref } from "vue"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    confirmLabel?: string
    destructive?: boolean
    action: () => Promise<unknown>
  }>(),
  { description: undefined, confirmLabel: "OK", destructive: false },
)

const open = ref(false)
const pending = ref(false)

// The trigger, Cancel and Escape all come here. The dialog stays open while the action runs.
function onOpenChange(value: boolean): void {
  if (pending.value) return
  open.value = value
}

// AlertDialogAction always closes the dialog on click, so the confirm button is a plain Button.
async function onConfirm(): Promise<void> {
  if (pending.value) return
  pending.value = true
  try {
    await props.action()
    open.value = false
  } catch {
    // The HTTP layer has already shown the error toast. The dialog stays open for a retry.
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <AlertDialog :open="open" @update:open="onOpenChange">
    <AlertDialogTrigger as-child><slot /></AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ title }}</AlertDialogTitle>
        <AlertDialogDescription v-if="description">{{ description }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="pending">Cancel</AlertDialogCancel>
        <Button :variant="destructive ? 'destructive' : 'default'" :disabled="pending" @click="onConfirm">
          <Spinner v-if="pending" />
          {{ confirmLabel }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
