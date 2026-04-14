<script setup>
/**
 * OrgFormModal — Modal form for creating or editing an organization.
 *
 * Props:
 *   - visible: controls modal visibility
 *   - org: existing organization object (null for create mode)
 *   - loading: disables the OK button while a request is in flight
 *
 * Emits:
 *   - submit({ name, description }) — validated form data
 *   - cancel — user dismissed the modal
 */

import { reactive, watch, computed } from "vue"
import { Form, Modal, Input } from "ant-design-vue"

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  org: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(["submit", "cancel"])

// Reactive form state bound to template inputs
const formState = reactive({
  name: "",
  description: "",
})

// Validation rules — name is required with a max length
const rules = reactive({
  name: [
    { required: true, message: "Please enter an organization name" },
    { max: 100, message: "Name cannot exceed 100 characters" },
  ],
})

// Form instance providing validate / resetFields helpers
const { validate, resetFields } = Form.useForm(formState, rules)

/**
 * Watch the org prop to populate the form when editing,
 * or reset it when switching to create mode.
 */
watch(
  () => props.org,
  (newOrg) => {
    if (newOrg) {
      formState.name = newOrg.name || ""
      formState.description = newOrg.description || ""
    } else {
      resetForm()
    }
  },
  { immediate: true },
)

/** Reset form fields back to their initial values. */
function resetForm() {
  resetFields()
}

/**
 * Validate and emit the form data on OK click.
 * If validation fails, ant-design-vue renders the errors automatically.
 */
async function handleOk() {
  try {
    await validate()
    emit("submit", {
      name: formState.name,
      description: formState.description || undefined,
    })
  } catch {
    // Validation failed — field-level errors are shown by ant-design-vue
  }
}

/** Cancel the modal and reset form state. */
function handleCancel() {
  resetForm()
  emit("cancel")
}

/**
 * Computed modal title — shows "Edit Organization" when an org prop
 * is provided, otherwise "Create Organization".
 */
const modalTitle = computed(() => {
  if (props.org) {
    return "Edit Organization"
  }
  return "Create Organization"
})
</script>

<template>
  <Modal
    :open="visible"
    :title="modalTitle"
    :confirm-loading="loading"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <Form :model="formState" :rules="rules" layout="vertical" autocomplete="off">
      <!-- Organization name (required) -->
      <Form.Item label="Name" name="name">
        <Input
          v-model:value="formState.name"
          placeholder="Enter organization name"
          :maxlength="100"
        />
      </Form.Item>

      <!-- Description (optional) -->
      <Form.Item label="Description" name="description">
        <Input.TextArea
          v-model:value="formState.description"
          placeholder="Enter description (optional)"
          :rows="4"
        />
      </Form.Item>
    </Form>
  </Modal>
</template>
