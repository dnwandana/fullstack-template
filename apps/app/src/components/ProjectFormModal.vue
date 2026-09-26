<script setup lang="ts">
/** Dialog form for a project. Emits `submit` with the payload, `cancel` on any close. */
import { computed, watch } from "vue"
import { useForm } from "vee-validate"
import { toTypedSchema } from "@vee-validate/zod"
import type { Project, Wire } from "@fullstack/contracts"
import type { ProjectInput } from "@/api/projects"
import { projectFormSchema } from "@/schemas/project"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"

const props = withDefaults(
  defineProps<{ open?: boolean; project?: Wire<Project> | null; loading?: boolean }>(),
  { open: false, project: null, loading: false },
)
const emit = defineEmits<{ submit: [payload: ProjectInput]; cancel: [] }>()

const form = useForm({
  validationSchema: toTypedSchema(projectFormSchema),
  initialValues: { name: "", description: "" },
})

// Reset on every open so a cancelled draft never leaks into the next open.
watch(
  [() => props.open, () => props.project],
  ([open, project]) => {
    if (!open) return
    form.resetForm({ values: { name: project?.name ?? "", description: project?.description ?? "" } })
  },
  { immediate: true },
)

const onSubmit = form.handleSubmit((values) => {
  emit("submit", { name: values.name, description: values.description || undefined })
})

function onOpenChange(value: boolean) {
  if (!value) emit("cancel")
}

const modalTitle = computed(() => (props.project ? "Edit Project" : "Create Project"))
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-lg" :aria-describedby="undefined">
      <DialogHeader>
        <DialogTitle>{{ modalTitle }}</DialogTitle>
      </DialogHeader>
      <form id="project-form" class="space-y-4" autocomplete="off" @submit="onSubmit">
        <FormField v-slot="{ componentField }" name="name">
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input placeholder="Enter project name" maxlength="100" v-bind="componentField" />
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
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" @click="emit('cancel')">Cancel</Button>
        <Button type="submit" form="project-form" :disabled="loading">
          <Spinner v-if="loading" /> OK
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
