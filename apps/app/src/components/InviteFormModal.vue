<script setup>
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

defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  roles: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(["submit", "cancel"])

const formState = reactive({
  email: "",
  role_id: undefined,
})

const rules = {
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
