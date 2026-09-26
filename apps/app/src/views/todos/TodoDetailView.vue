<script setup lang="ts">
import { onMounted, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { ArrowLeft, Pencil, SearchX, Trash2 } from "@lucide/vue"
import { useTodos } from "@/composables/useTodos"
import { usePermissions } from "@/composables/usePermissions"
import { useAuthStore } from "@/stores/auth"
import TodoFormModal from "@/components/TodoFormModal.vue"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table"

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

// Format date
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString()
}
</script>

<template>
  <div class="space-y-6">
    <!-- Loading state -->
    <div v-if="loading" class="flex min-h-[200px] items-center justify-center">
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
        <Button @click="goBack">Back to Todos</Button>
      </EmptyContent>
    </Empty>

    <!-- Todo content -->
    <template v-else>
      <!-- Header with actions -->
      <div class="flex flex-wrap items-center justify-between gap-2">
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
            @confirm="handleDelete"
          >
            <Button variant="destructive"><Trash2 /> Delete</Button>
          </ConfirmDialog>
        </div>
      </div>

      <h1 class="text-xl font-semibold tracking-tight">{{ currentTodo.title }}</h1>

      <!-- Todo details -->
      <div class="rounded-md border">
        <Table>
          <TableBody>
            <TableRow>
              <TableHead class="w-[160px] bg-muted/50">Status</TableHead>
              <TableCell>
                <Badge :variant="currentTodo.is_completed ? 'success' : 'secondary'">
                  {{ currentTodo.is_completed ? "Completed" : "Pending" }}
                </Badge>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableHead class="bg-muted/50">Description</TableHead>
              <TableCell>{{ currentTodo.description || "No description" }}</TableCell>
            </TableRow>
            <TableRow>
              <TableHead class="bg-muted/50">Created At</TableHead>
              <TableCell>{{ formatDate(currentTodo.created_at) }}</TableCell>
            </TableRow>
            <TableRow>
              <TableHead class="bg-muted/50">Updated At</TableHead>
              <TableCell>{{ formatDate(currentTodo.updated_at) }}</TableCell>
            </TableRow>
            <TableRow>
              <TableHead class="bg-muted/50">ID</TableHead>
              <TableCell>
                <code class="rounded bg-muted px-1 py-0.5 font-mono text-xs">{{
                  currentTodo.id
                }}</code>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </template>

    <!-- Edit Modal -->
    <TodoFormModal
      :open="isModalVisible"
      :todo="editingTodo"
      :loading="loading"
      @submit="handleSubmit"
      @cancel="closeModal"
    />
  </div>
</template>
