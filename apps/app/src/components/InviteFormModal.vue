<script setup lang="ts">
/**
 * Dialog form that invites a member by email with a role. With `acceptUrl` set, it shows the new
 * link once. Emits `cancel` when the user closes it.
 */
import { watch } from "vue"
import { useForm } from "vee-validate"
import { toTypedSchema } from "@vee-validate/zod"
import type { Role, Wire } from "@fullstack/contracts"
import type { InviteInput } from "@/api/invitations"
import { inviteFormSchema } from "@/schemas/invite"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import InviteLinkField from "@/components/InviteLinkField.vue"

const props = withDefaults(
  defineProps<{ open?: boolean; roles?: Wire<Role>[]; loading?: boolean; acceptUrl?: string | null }>(),
  { open: false, roles: () => [], loading: false, acceptUrl: null },
)
const emit = defineEmits<{ submit: [payload: InviteInput]; cancel: [] }>()

// The form view has no description. The link view has one, and reka links it only when this
// attribute is absent.
const NO_DESCRIPTION = { "aria-describedby": undefined }

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
    <DialogContent v-bind="acceptUrl ? {} : NO_DESCRIPTION">
      <DialogHeader>
        <DialogTitle>Invite Member</DialogTitle>
        <DialogDescription v-if="acceptUrl">Copy this link and send it to the invitee. It is shown once.</DialogDescription>
      </DialogHeader>
      <InviteLinkField v-if="acceptUrl" :url="acceptUrl" />
      <form v-else id="invite-form" class="space-y-4" autocomplete="off" @submit="onSubmit">
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
        <Button v-if="acceptUrl" type="button" @click="emit('cancel')">OK</Button>
        <template v-else>
          <Button type="button" variant="outline" @click="emit('cancel')">Cancel</Button>
          <Button type="submit" form="invite-form" :disabled="loading"><Spinner v-if="loading" /> OK</Button>
        </template>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
