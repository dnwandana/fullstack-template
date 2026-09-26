<script setup lang="ts">
/** Dialog form for a todo. Emits `submit` with the payload, `cancel` on any close. */
import { computed, watch } from "vue"
import { useForm } from "vee-validate"
import { toTypedSchema } from "@vee-validate/zod"
import type { Todo, Wire } from "@fullstack/contracts"
import type { TodoInput } from "@/api/todos"
import { todoFormSchema } from "@/schemas/todo"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"

const props = withDefaults(
  defineProps<{ open?: boolean; todo?: Wire<Todo> | null; loading?: boolean }>(),
  { open: false, todo: null, loading: false },
)
const emit = defineEmits<{ submit: [payload: TodoInput]; cancel: [] }>()

const form = useForm({
  validationSchema: toTypedSchema(todoFormSchema),
  initialValues: { title: "", description: "", is_completed: false },
})

// Reset on every open so a cancelled draft never leaks into the next open.
watch(
  [() => props.open, () => props.todo],
  ([open, todo]) => {
    if (!open) return
    form.resetForm({
      values: {
        title: todo?.title ?? "",
        description: todo?.description ?? "",
        is_completed: todo?.is_completed ?? false,
      },
    })
  },
  { immediate: true },
)

const onSubmit = form.handleSubmit((values) => {
  emit("submit", {
    title: values.title,
    description: values.description || undefined,
    is_completed: values.is_completed,
  })
})

function onOpenChange(value: boolean) {
  if (!value) emit("cancel")
}

const modalTitle = computed(() => (props.todo ? "Edit Todo" : "Create Todo"))
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-lg" :aria-describedby="undefined">
      <DialogHeader>
        <DialogTitle>{{ modalTitle }}</DialogTitle>
      </DialogHeader>
      <form id="todo-form" class="space-y-4" autocomplete="off" @submit="onSubmit">
        <FormField v-slot="{ componentField }" name="title">
          <FormItem>
            <FormLabel>Title</FormLabel>
            <FormControl>
              <Input placeholder="Enter todo title" maxlength="255" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ componentField }" name="description">
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Enter description (optional)"
                :rows="4"
                v-bind="componentField"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ value, handleChange }" name="is_completed">
          <FormItem class="flex items-center gap-2">
            <FormControl>
              <Checkbox :model-value="value" @update:model-value="(v) => handleChange(v === true)" />
            </FormControl>
            <FormLabel class="font-normal">Mark as completed</FormLabel>
          </FormItem>
        </FormField>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" @click="emit('cancel')">Cancel</Button>
        <Button type="submit" form="todo-form" :disabled="loading">
          <Spinner v-if="loading" /> OK
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
