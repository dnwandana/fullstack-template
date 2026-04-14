<script setup>
/**
 * RoleFormModal — Modal form for creating or editing a role with permissions.
 *
 * Permissions are grouped by their `resource` field and displayed as
 * checkbox sections so the user can toggle individual permissions.
 *
 * Props:
 *   - visible: controls modal visibility
 *   - role: existing role object (null for create mode)
 *   - permissions: all available permissions from the API
 *   - loading: disables the OK button while a request is in flight
 *
 * Emits:
 *   - submit({ name, description, permissions }) — validated form data
 *   - cancel — user dismissed the modal
 */

import { reactive, watch, computed } from "vue"
import { Form, Modal, Input, Checkbox, Typography } from "ant-design-vue"

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  role: {
    type: Object,
    default: null,
  },
  permissions: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(["submit", "cancel"])

// Reactive form state — selectedPermissions holds an array of permission IDs
const formState = reactive({
  name: "",
  description: "",
  selectedPermissions: [],
})

// Validation rules — name is required, at least one permission must be selected
const rules = reactive({
  name: [{ required: true, message: "Please enter a role name" }],
  selectedPermissions: [
    {
      /**
       * Custom validator that ensures at least one permission is checked.
       * Ant Design's built-in required validator does not handle arrays well.
       */
      validator: async (_rule, value) => {
        if (!value || value.length === 0) {
          throw new Error("Please select at least one permission")
        }
      },
    },
  ],
})

// Form instance providing validate / resetFields helpers
const { validate, resetFields } = Form.useForm(formState, rules)

/**
 * Watch the role prop to populate the form when editing,
 * or reset it when switching to create mode.
 */
watch(
  () => props.role,
  (newRole) => {
    if (newRole) {
      formState.name = newRole.name || ""
      formState.description = newRole.description || ""
      // Map the role's permission objects to an array of IDs for the checkbox group
      if (newRole.permissions && Array.isArray(newRole.permissions)) {
        formState.selectedPermissions = newRole.permissions.map((p) => p.id)
      } else {
        formState.selectedPermissions = []
      }
    } else {
      resetForm()
    }
  },
  { immediate: true },
)

/**
 * Group permissions by their `resource` field so the template can render
 * them as labelled sections (e.g. "organization", "project", "todo").
 *
 * @returns {Record<string, Array>} — keyed by resource name
 */
const groupedPermissions = computed(() => {
  const groups = {}
  for (const perm of props.permissions) {
    if (!groups[perm.resource]) {
      groups[perm.resource] = []
    }
    groups[perm.resource].push(perm)
  }
  return groups
})

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
      permissions: formState.selectedPermissions,
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
 * Computed modal title — shows "Edit Role" when a role prop
 * is provided, otherwise "Create Role".
 */
const modalTitle = computed(() => {
  if (props.role) {
    return "Edit Role"
  }
  return "Create Role"
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
      <!-- Role name (required) -->
      <Form.Item label="Name" name="name">
        <Input v-model:value="formState.name" placeholder="Enter role name" />
      </Form.Item>

      <!-- Role description (optional) -->
      <Form.Item label="Description" name="description">
        <Input.TextArea
          v-model:value="formState.description"
          placeholder="Enter description (optional)"
          :rows="3"
        />
      </Form.Item>

      <!-- Permissions grouped by resource -->
      <Form.Item label="Permissions" name="selectedPermissions">
        <Checkbox.Group v-model:value="formState.selectedPermissions" style="width: 100%">
          <div
            v-for="(perms, resource) in groupedPermissions"
            :key="resource"
            style="margin-bottom: 12px"
          >
            <!-- Resource section header (e.g. "organization", "project") -->
            <Typography.Text
              strong
              style="text-transform: capitalize; display: block; margin-bottom: 4px"
            >
              {{ resource }}
            </Typography.Text>

            <!-- Individual permission checkboxes -->
            <div v-for="perm in perms" :key="perm.id" style="margin-left: 8px">
              <Checkbox :value="perm.id">{{ perm.description }}</Checkbox>
            </div>
          </div>
        </Checkbox.Group>
      </Form.Item>
    </Form>
  </Modal>
</template>
