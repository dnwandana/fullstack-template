<script setup lang="ts">
/** Dialog form for an organization. Emits `submit` with the payload, `cancel` on any close. */
import { computed, watch } from "vue"
import { useForm } from "vee-validate"
import { toTypedSchema } from "@vee-validate/zod"
import type { Org, Wire } from "@fullstack/contracts"
import type { OrgInput } from "@/api/orgs"
import { orgFormSchema } from "@/schemas/org"
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
  defineProps<{ open?: boolean; org?: Wire<Org> | null; loading?: boolean }>(),
  { open: false, org: null, loading: false },
)
const emit = defineEmits<{ submit: [payload: OrgInput]; cancel: [] }>()

const form = useForm({
  validationSchema: toTypedSchema(orgFormSchema),
  initialValues: { name: "", description: "" },
})

// Reset on every open so a cancelled draft never leaks into the next open.
watch(
  [() => props.open, () => props.org],
  ([open, org]) => {
    if (!open) return
    form.resetForm({ values: { name: org?.name ?? "", description: org?.description ?? "" } })
  },
  { immediate: true },
)

const onSubmit = form.handleSubmit((values) => {
  emit("submit", { name: values.name, description: values.description || undefined })
})

function onOpenChange(value: boolean) {
  if (!value) emit("cancel")
}

const modalTitle = computed(() => (props.org ? "Edit Organization" : "Create Organization"))
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-lg" :aria-describedby="undefined">
      <DialogHeader>
        <DialogTitle>{{ modalTitle }}</DialogTitle>
      </DialogHeader>
      <form id="org-form" class="space-y-4" autocomplete="off" @submit="onSubmit">
        <FormField v-slot="{ componentField }" name="name">
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input placeholder="Enter organization name" maxlength="100" v-bind="componentField" />
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
        <Button type="submit" form="org-form" :disabled="loading">
          <Spinner v-if="loading" /> OK
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
