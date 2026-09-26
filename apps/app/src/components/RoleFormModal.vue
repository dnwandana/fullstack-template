<script setup lang="ts">
/** Dialog form for a role. Emits `submit` with the payload, `cancel` on any close. */
import { computed, watch } from "vue"
import { useForm } from "vee-validate"
import { toTypedSchema } from "@vee-validate/zod"
import type { Permission, Role, Wire } from "@fullstack/contracts"
import type { RoleFormInput } from "@/api/roles"
import { roleFormSchema } from "@/schemas/role"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"

const props = withDefaults(
  defineProps<{
    open?: boolean
    role?: Wire<Role> | null
    permissions?: Wire<Permission>[]
    loading?: boolean
  }>(),
  { open: false, role: null, permissions: () => [], loading: false },
)
const emit = defineEmits<{ submit: [payload: RoleFormInput]; cancel: [] }>()

const noPermissions: string[] = []

const form = useForm({
  validationSchema: toTypedSchema(roleFormSchema),
  initialValues: { name: "", description: "", permissions: noPermissions },
})

// Reset on every open so a cancelled draft never leaks into the next open.
watch(
  [() => props.open, () => props.role],
  ([open, role]) => {
    if (!open) return
    const { name = "", description = "", permissions = [] } = role ?? {}
    form.resetForm({
      values: { name, description: description ?? "", permissions: permissions.map((p) => p.id) },
    })
  },
  { immediate: true },
)

const onSubmit = form.handleSubmit((values) => {
  emit("submit", {
    name: values.name,
    description: values.description || undefined,
    permissions: values.permissions,
  })
})

function onOpenChange(value: boolean) {
  if (!value) emit("cancel")
}

/** Permissions keyed by `resource`, in first-seen order. */
const groupedPermissions = computed(() => {
  const groups: Record<string, Wire<Permission>[]> = {}
  for (const perm of props.permissions) (groups[perm.resource] ??= []).push(perm)
  return groups
})

const modalTitle = computed(() => (props.role ? "Edit Role" : "Create Role"))
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-lg" :aria-describedby="undefined">
      <DialogHeader><DialogTitle>{{ modalTitle }}</DialogTitle></DialogHeader>
      <form id="role-form" class="space-y-4" autocomplete="off" @submit="onSubmit">
        <FormField v-slot="{ componentField }" name="name">
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl><Input placeholder="Enter role name" v-bind="componentField" /></FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ componentField }" name="description">
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl><Textarea placeholder="Enter description (optional)" :rows="3" v-bind="componentField" /></FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField name="permissions">
          <FormItem>
            <FormLabel>Permissions</FormLabel>
            <div v-for="(perms, resource) in groupedPermissions" :key="resource" class="mb-3">
              <p data-testid="perm-group" class="mb-1 text-sm font-semibold capitalize">{{ resource }}</p>
              <FormField
                v-for="perm in perms"
                :key="perm.id"
                v-slot="{ value, handleChange }"
                type="checkbox"
                :value="perm.id"
                :unchecked-value="false"
                name="permissions"
              >
                <FormItem class="ml-2 flex items-center gap-2">
                  <FormControl>
                    <Checkbox :model-value="value.includes(perm.id)" @update:model-value="handleChange" />
                  </FormControl>
                  <FormLabel class="font-normal">{{ perm.description }}</FormLabel>
                </FormItem>
              </FormField>
            </div>
            <FormMessage />
          </FormItem>
        </FormField>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" @click="emit('cancel')">Cancel</Button>
        <Button type="submit" form="role-form" :disabled="loading"><Spinner v-if="loading" /> OK</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
