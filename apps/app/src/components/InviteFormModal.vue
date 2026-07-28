<script setup lang="ts">
/**
 * InviteFormModal — Modal form for inviting a member by email.
 *
 * Props:
 *   - visible: controls modal visibility
 *   - roles: available roles for the role selection dropdown
 *   - loading: disables the OK button while a request is in flight
 *
 * Emits:
 *   - submit({ email, role_id }) — validated invite payload
 *   - cancel — user dismissed the modal
 */

import { reactive } from "vue"
import { Form, Modal, Input, Select } from "ant-design-vue"
import type { Rule } from "ant-design-vue/es/form"
import type { Role, Wire } from "@fullstack/contracts"
import type { InviteInput } from "@/api/invitations"

interface Props {
  visible?: boolean
  roles?: Wire<Role>[]
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  visible: false,
  roles: () => [],
  loading: false,
})

const emit = defineEmits<{
  submit: [payload: InviteInput]
  cancel: []
}>()

const formState = reactive<{ email: string; role_id: string | undefined }>({
  email: "",
  role_id: undefined,
})

const rules: Record<string, Rule[]> = {
  email: [
    { required: true, message: "Please enter an email address" },
    { type: "email", message: "Please enter a valid email address" },
  ],
  role_id: [{ required: true, message: "Please select a role" }],
}

// Form instance providing validate / resetFields helpers
const { validate, resetFields } = Form.useForm(formState, rules)

/** Validate and emit the invite payload on OK click. */
async function handleOk() {
  try {
    await validate()
    // TODO(ts-migration): `formState.role_id` is `string | undefined` because `undefined` is
    // what `<a-select>` treats as "nothing selected", but `InviteInput.role_id` is `string`.
    // The gap is unreachable at runtime — the `role_id` required rule makes `validate()` reject
    // before this line when nothing is selected — but the compiler cannot see that invariant,
    // and proving it would mean adding a guard, i.e. changing runtime behaviour.
    // @ts-expect-error — see above. This directive self-clears (as an unused-directive error)
    // if the emit payload or the form state type ever changes to make the assignment valid.
    emit("submit", { email: formState.email, role_id: formState.role_id })
  } catch {
    // Validation failed — field-level errors are shown by ant-design-vue
  }
}

/** Cancel the modal and reset form state. */
function handleCancel() {
  resetFields()
  emit("cancel")
}
</script>

<template>
  <Modal
    :open="visible"
    title="Invite Member"
    :confirm-loading="loading"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <Form :model="formState" :rules="rules" layout="vertical" autocomplete="off">
      <Form.Item label="Email" name="email">
        <Input v-model:value="formState.email" placeholder="Enter email address" />
      </Form.Item>

      <Form.Item label="Role" name="role_id">
        <Select v-model:value="formState.role_id" placeholder="Select a role">
          <Select.Option v-for="role in roles" :key="role.id" :value="role.id">
            {{ role.name }}
          </Select.Option>
        </Select>
      </Form.Item>
    </Form>
  </Modal>
</template>
