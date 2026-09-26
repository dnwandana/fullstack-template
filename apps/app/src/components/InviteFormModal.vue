<script setup lang="ts">
/** Dialog form that invites a member by email with a role. */
import { watch } from "vue"
import { useForm } from "vee-validate"
import { toTypedSchema } from "@vee-validate/zod"
import type { Role, Wire } from "@fullstack/contracts"
import type { InviteInput } from "@/api/invitations"
import { inviteFormSchema } from "@/schemas/invite"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"

const props = withDefaults(
  defineProps<{ open?: boolean; roles?: Wire<Role>[]; loading?: boolean }>(),
  { open: false, roles: () => [], loading: false },
)
const emit = defineEmits<{ submit: [payload: InviteInput]; cancel: [] }>()

const form = useForm({
  validationSchema: toTypedSchema(inviteFormSchema),
  initialValues: { email: "", role_id: "" },
})

// Reset on every open so a cancelled draft never leaks into the next open.
watch(
  () => props.open,
  (open) => {
    if (open) form.resetForm({ values: { email: "", role_id: "" } })
  },
  { immediate: true },
)

const onSubmit = form.handleSubmit((values) => {
  emit("submit", { email: values.email, role_id: values.role_id })
})

function onOpenChange(value: boolean) {
  if (!value) emit("cancel")
}

/** Test seam: reka Select has no pointer path in jsdom. */
function setRole(roleId: string) {
  form.setFieldValue("role_id", roleId)
}
defineExpose({ setRole })
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-md" :aria-describedby="undefined">
      <DialogHeader><DialogTitle>Invite Member</DialogTitle></DialogHeader>
      <form id="invite-form" class="space-y-4" autocomplete="off" @submit="onSubmit">
        <FormField v-slot="{ componentField }" name="email">
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl><Input type="email" placeholder="Enter email address" v-bind="componentField" /></FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ componentField }" name="role_id">
          <FormItem>
            <FormLabel>Role</FormLabel>
            <Select v-bind="componentField">
              <FormControl>
                <SelectTrigger class="w-full"><SelectValue placeholder="Select a role" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem v-for="role in props.roles" :key="role.id" :value="role.id">{{ role.name }}</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        </FormField>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" @click="emit('cancel')">Cancel</Button>
        <Button type="submit" form="invite-form" :disabled="loading"><Spinner v-if="loading" /> OK</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
