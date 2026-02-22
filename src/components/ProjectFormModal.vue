<script setup>
/**
 * ProjectFormModal — Modal form for creating or editing a project.
 *
 * Props:
 *   - visible: controls modal visibility
 *   - project: existing project object (null for create mode)
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
  project: {
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
    { required: true, message: "Please enter a project name" },
    { max: 100, message: "Name cannot exceed 100 characters" },
  ],
})

// Form instance providing validate / resetFields helpers
const { validate, resetFields } = Form.useForm(formState, rules)

/**
 * Watch the project prop to populate the form when editing,
 * or reset it when switching to create mode.
 */
watch(
  () => props.project,
  (newProject) => {
    if (newProject) {
      formState.name = newProject.name || ""
      formState.description = newProject.description || ""
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
 * Computed modal title — shows "Edit Project" when a project prop
 * is provided, otherwise "Create Project".
 */
const modalTitle = computed(() => {
  if (props.project) {
    return "Edit Project"
  }
  return "Create Project"
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
      <!-- Project name (required) -->
      <Form.Item label="Name" name="name">
        <Input v-model:value="formState.name" placeholder="Enter project name" :maxlength="100" />
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
