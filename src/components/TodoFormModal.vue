<script setup>
import { reactive, watch } from 'vue'
import { Form, Modal, Input, Checkbox } from 'ant-design-vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  todo: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['submit', 'cancel'])

// Form state
const formState = reactive({
  title: '',
  description: '',
  is_completed: false,
})

// Validation rules
const rules = reactive({
  title: [
    { required: true, message: 'Please enter a title' },
    { max: 255, message: 'Title cannot exceed 255 characters' },
  ],
})

// Form instance with validation
const { validate, resetFields } = Form.useForm(formState, rules)

// Watch for todo prop changes to populate form
watch(
  () => props.todo,
  (newTodo) => {
    if (newTodo) {
      formState.title = newTodo.title || ''
      formState.description = newTodo.description || ''
      formState.is_completed = newTodo.is_completed || false
    } else {
      resetForm()
    }
  },
  { immediate: true },
)

// Reset form to initial state
function resetForm() {
  resetFields()
}

// Handle form submission
async function handleOk() {
  try {
    await validate()
    emit('submit', {
      title: formState.title,
      description: formState.description || undefined,
      is_completed: formState.is_completed,
    })
  } catch {
    // Validation failed, errors are displayed by ant-design-vue
  }
}

// Handle cancel
function handleCancel() {
  resetForm()
  emit('cancel')
}

// Computed title for modal
const modalTitle = computed(() => (props.todo ? 'Edit Todo' : 'Create Todo'))

import { computed } from 'vue'
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
      <Form.Item label="Title" name="title">
        <Input v-model:value="formState.title" placeholder="Enter todo title" :maxlength="255" />
      </Form.Item>

      <Form.Item label="Description" name="description">
        <Input.TextArea
          v-model:value="formState.description"
          placeholder="Enter description (optional)"
          :rows="4"
        />
      </Form.Item>

      <Form.Item name="is_completed">
        <Checkbox v-model:checked="formState.is_completed"> Mark as completed </Checkbox>
      </Form.Item>
    </Form>
  </Modal>
</template>
