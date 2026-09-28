<script setup lang="ts">
import { onMounted, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { ArrowLeft, Pencil, SearchX, Trash2 } from "@lucide/vue"
import type { TodoInput } from "@/api/todos"
import { useTodos } from "@/composables/useTodos"
import { usePermissions } from "@/composables/usePermissions"
import { useAuthStore } from "@/stores/auth"
import TodoFormModal from "@/components/TodoFormModal.vue"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { formatDateTime } from "@/utils/format"

const route = useRoute()
const router = useRouter()

// Extract multi-tenant identifiers and todo ID from route params
const orgId = String(route.params.orgId)
const projectId = String(route.params.projectId)
const todoId = String(route.params.id)

const {
  currentTodo,
  loading,
  isModalVisible,
  editingTodo,
  fetchTodoById,
  deleteTodo,
  clearCurrentTodo,
  openEditModal,
  closeModal,
  handleSubmit,
  setContext,
} = useTodos()

const { can, loadPermissions } = usePermissions()
const authStore = useAuthStore()

// Set multi-tenant context and load supporting data before fetching the todo
onMounted(async () => {
  // Scope API calls to the correct org/project
  setContext(orgId, projectId)

  // Load user permissions for this org to gate UI actions
  // TODO(ts-migration): this read was unguarded and would have thrown on a null user. `?.` matches
  // the other views. No observable change — `usePermissions` names the parameter `_userId` and
  // discards it.
  loadPermissions(orgId, authStore.currentUser?.id)

  // Fetch the individual todo. The store clears `currentTodo` on failure, so the
  // not-found state renders. The catch stops the rejection from going unhandled.
  try {
    await fetchTodoById(todoId)
  } catch {
    // Nothing to do here. The HTTP layer already shows the error toast.
  }
})

// Clear current todo when navigating away (route param disappears)
watch(
  () => route.params.id,
  (newId, oldId) => {
    if (oldId && !newId) {
      clearCurrentTodo()
    }
  },
)

// Navigate back to the project-level todos list
function goBack(): void {
  router.push(`/orgs/${orgId}/projects/${projectId}`)
}

// Handle edit
function handleEdit(): void {
  if (currentTodo.value) {
    openEditModal(currentTodo.value)
  }
}

// Handle delete, then redirect back to project
async function handleDelete(): Promise<void> {
  await deleteTodo(todoId)
  router.push(`/orgs/${orgId}/projects/${projectId}`)
}

// The store loading flag drives the page spinner. The dialog uses its own flag, so a save does not
// hide the page behind the dialog.
const saving = ref(false)

// One field row: the label sits above its value on a phone and beside it from md.
const FIELD_ROW =
  "grid grid-cols-1 items-baseline gap-x-4 gap-y-1 border-b px-5 py-3.5 last:border-b-0 md:grid-cols-[140px_minmax(0,1fr)]"
const FIELD_LABEL = "text-[13px] font-medium text-muted-foreground"

/** Saves the dialog values, then refetches the todo so that the page shows the saved values. */
async function onSubmit(values: TodoInput): Promise<void> {
  saving.value = true
  try {
    await handleSubmit(values)
    await fetchTodoById(todoId)
  } catch {
    // The HTTP layer already shows the error toast. The dialog stays open for a retry.
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="grid max-w-[880px] gap-5">
    <!-- Loading state -->
    <div
      v-if="loading && !currentTodo"
      class="flex min-h-[420px] items-center justify-center text-muted-foreground"
    >
      <Spinner class="size-6" />
    </div>

    <!-- Not found state -->
    <Empty v-else-if="!currentTodo">
      <EmptyHeader>
        <EmptyMedia variant="icon"><SearchX /></EmptyMedia>
        <EmptyTitle>Todo not found</EmptyTitle>
        <EmptyDescription>
          The todo you're looking for doesn't exist or has been deleted.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" @click="goBack"><ArrowLeft /> Back to Todos</Button>
      </EmptyContent>
    </Empty>

    <!-- Todo content -->
    <template v-else>
      <!-- Header with actions -->
      <div data-slot="todo-actions" class="flex items-center justify-between gap-2">
        <Button variant="outline" @click="goBack"><ArrowLeft /> Back</Button>
        <div class="flex items-center gap-2">
          <!-- Edit button (permission-gated) -->
          <Button v-if="can('todos:update')" @click="handleEdit"><Pencil /> Edit</Button>
          <!-- Delete button (permission-gated) -->
          <ConfirmDialog
            v-if="can('todos:delete')"
            title="Delete this todo?"
            confirm-label="Yes"
            destructive
            :action="handleDelete"
          >
            <Button variant="destructive"><Trash2 /> Delete</Button>
          </ConfirmDialog>
        </div>
      </div>

      <h1 class="text-xl font-semibold tracking-tight text-pretty">{{ currentTodo.title }}</h1>

      <!-- Todo details -->
      <Card class="grid">
        <div data-slot="todo-field" :class="FIELD_ROW">
          <div :class="FIELD_LABEL">Status</div>
          <div class="min-w-0">
            <Badge :variant="currentTodo.is_completed ? 'success' : 'secondary'">
              {{ currentTodo.is_completed ? "Completed" : "Pending" }}
            </Badge>
          </div>
        </div>
        <div data-slot="todo-field" :class="FIELD_ROW">
          <div :class="FIELD_LABEL">Description</div>
          <div
            :class="['min-w-0 text-pretty', !currentTodo.description && 'text-muted-foreground']"
          >
            {{ currentTodo.description || "No description" }}
          </div>
        </div>
        <div data-slot="todo-field" :class="FIELD_ROW">
          <div :class="FIELD_LABEL">Created At</div>
          <div class="min-w-0 tabular-nums">{{ formatDateTime(currentTodo.created_at) }}</div>
        </div>
        <div data-slot="todo-field" :class="FIELD_ROW">
          <div :class="FIELD_LABEL">Updated At</div>
          <div class="min-w-0 tabular-nums">{{ formatDateTime(currentTodo.updated_at) }}</div>
        </div>
        <div data-slot="todo-field" :class="FIELD_ROW">
          <div :class="FIELD_LABEL">ID</div>
          <div class="min-w-0">
            <code
              class="inline-block max-w-full truncate rounded-md border bg-muted px-1.5 py-0.5 align-middle font-mono text-[12px]"
              >{{ currentTodo.id }}</code
            >
          </div>
        </div>
      </Card>
    </template>

    <!-- Edit Modal -->
    <TodoFormModal
      :open="isModalVisible"
      :todo="editingTodo"
      :loading="saving"
      @submit="onSubmit"
      @cancel="closeModal"
    />
  </div>
</template>
