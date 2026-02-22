<script setup>
/**
 * InviteFormModal — Modal form for inviting a member by username or email.
 *
 * The user toggles between "Username" and "Email" via a radio group,
 * and only the relevant field is validated and submitted.
 *
 * Props:
 *   - visible: controls modal visibility
 *   - roles: available roles for the role selection dropdown
 *   - loading: disables the OK button while a request is in flight
 *
 * Emits:
 *   - submit({ username?, email?, role_id }) — validated invite payload
 *   - cancel — user dismissed the modal
 */

import { reactive, watch, computed } from "vue"
import { Form, Modal, Input, Select, Radio } from "ant-design-vue"

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

// Reactive form state — inviteBy determines which field is shown and validated
const formState = reactive({
  inviteBy: "username",
  username: "",
  email: "",
  role_id: undefined,
})

/**
 * Validation rules.
 * Username and email rules are dynamically toggled based on formState.inviteBy
 * so that only the active field is validated.
 */
const rules = computed(() => {
  const baseRules = {
    role_id: [{ required: true, message: "Please select a role" }],
  }

  if (formState.inviteBy === "username") {
    baseRules.username = [{ required: true, message: "Please enter a username" }]
  } else {
    baseRules.email = [
      { required: true, message: "Please enter an email address" },
      { type: "email", message: "Please enter a valid email address" },
    ]
  }

  return baseRules
})

// Form instance providing validate / resetFields helpers
const { validate, resetFields } = Form.useForm(formState, rules)

/**
 * When the invite method changes, clear the field that is no longer active
 * so stale values do not get submitted.
 */
watch(
  () => formState.inviteBy,
  (newMethod) => {
    if (newMethod === "username") {
      formState.email = ""
    } else {
      formState.username = ""
    }
  },
)

/** Reset form fields back to their initial values. */
function resetForm() {
  resetFields()
}

/**
 * Validate and emit the invite payload on OK click.
 * Only the active field (username or email) is included in the payload.
 */
async function handleOk() {
  try {
    await validate()

    // Build payload with only the relevant identifier field
    const payload = { role_id: formState.role_id }
    if (formState.inviteBy === "username") {
      payload.username = formState.username
    } else {
      payload.email = formState.email
    }

    emit("submit", payload)
  } catch {
    // Validation failed — field-level errors are shown by ant-design-vue
  }
}

/** Cancel the modal and reset form state. */
function handleCancel() {
  resetForm()
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
      <!-- Toggle between inviting by username or email -->
      <Form.Item label="Invite by">
        <Radio.Group v-model:value="formState.inviteBy">
          <Radio value="username">Username</Radio>
          <Radio value="email">Email</Radio>
        </Radio.Group>
      </Form.Item>

      <!-- Username field (shown when inviting by username) -->
      <Form.Item v-if="formState.inviteBy === 'username'" label="Username" name="username">
        <Input v-model:value="formState.username" placeholder="Enter username" />
      </Form.Item>

      <!-- Email field (shown when inviting by email) -->
      <Form.Item v-else label="Email" name="email">
        <Input v-model:value="formState.email" placeholder="Enter email address" />
      </Form.Item>

      <!-- Role selection (required) -->
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
