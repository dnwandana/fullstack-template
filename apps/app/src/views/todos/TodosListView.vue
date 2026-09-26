<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import { Plus, Trash2, Pencil, Eye, Search } from "@lucide/vue"
import { useTodos } from "@/composables/useTodos"
import { usePermissions } from "@/composables/usePermissions"
import { useAuthStore } from "@/stores/auth"
import TodoFormModal from "@/components/TodoFormModal.vue"
import PageHeader from "@/components/PageHeader.vue"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const route = useRoute()
const router = useRouter()

// Extract multi-tenant identifiers from route params
const orgId = String(route.params.orgId)
const projectId = String(route.params.projectId)

const {
  todos,
  pagination,
  loading,
  selectedIds,
  hasSelected,
  selectedCount,
  sortBy,
  sortOrder,
  isModalVisible,
  editingTodo,
  fetchTodos,
  deleteTodo,
  bulkDelete,
  openCreateModal,
  openEditModal,
  closeModal,
  handleSubmit,
  handlePageChange,
  handleSortChange,
  handleSearch,
  handleSelectionChange,
  searchQuery,
  setContext,
} = useTodos()

const { can, loadPermissions } = usePermissions()
const authStore = useAuthStore()

const allSelected = computed(
  () => todos.value.length > 0 && todos.value.every((t) => selectedIds.value.includes(t.id)),
)

function toggleAll(checked: boolean): void {
  handleSelectionChange(checked ? todos.value.map((t) => t.id) : [])
}

function toggleOne(id: string, checked: boolean): void {
  const kept = selectedIds.value.filter((selected) => selected !== id)
  handleSelectionChange(checked ? [...kept, id] : kept)
}

const PAGE_SIZES = [10, 20, 50]

const rangeText = computed(() => {
  const { current_page, items_per_page, total_items } = pagination.value
  const first = total_items === 0 ? 0 : (current_page - 1) * items_per_page + 1
  const last = Math.min(current_page * items_per_page, total_items)
  return `${first}-${last} of ${total_items}`
})

function onPageSizeChange(value: unknown): void {
  handlePageChange(1, Number(value))
}

function onPageChange(page: number): void {
  if (page !== pagination.value.current_page) handlePageChange(page, pagination.value.items_per_page)
}

defineExpose({ toggleAll, toggleOne, allSelected, onPageSizeChange })

// Sort options
const sortByOptions = [
  { value: "updated_at", label: "Updated At" },
  { value: "title", label: "Title" },
]

const sortOrderOptions = [
  { value: "desc", label: "Descending" },
  { value: "asc", label: "Ascending" },
]

// Navigate to todo detail using multi-tenant route
function viewTodo(id: string): void {
  router.push(`/orgs/${orgId}/projects/${projectId}/todos/${id}`)
}

// Handle edit
function editTodo(id: string): void {
  const todo = todos.value.find((candidate) => candidate.id === id)
  if (todo) {
    openEditModal(todo)
  }
}

// Handle delete with confirmation
async function handleDelete(id: string): Promise<void> {
  await deleteTodo(id)
}

// Handle bulk delete
async function handleBulkDelete(): Promise<void> {
  await bulkDelete()
}

// Search input value (local ref for two-way binding)
const searchValue = ref("")

function onSearch(value: string): void {
  handleSearch(value)
}

function clearSearch(): void {
  searchValue.value = ""
  handleSearch("")
}

// Handle sort by change
function onSortByChange(value: string): void {
  handleSortChange(value, sortOrder.value)
}

// Handle sort order change
function onSortOrderChange(value: string): void {
  handleSortChange(sortBy.value, value)
}

// Set multi-tenant context, load supporting data, then fetch todos
onMounted(async () => {
  // Set org/project context so the store scopes API calls correctly
  setContext(orgId, projectId)

  // Load user permissions for this org to gate UI actions
  // TODO(ts-migration): this read was unguarded and would have thrown on a null user. `?.` matches
  // the other views. No observable change — `usePermissions` names the parameter `_userId` and
  // discards it.
  loadPermissions(orgId, authStore.currentUser?.id)

  // Fetch the todos list
  fetchTodos()
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Todos">
      <InputGroup class="w-[250px]">
        <InputGroupAddon><Search class="size-4" /></InputGroupAddon>
        <InputGroupInput v-model="searchValue" placeholder="Search todos..." @keydown.enter="onSearch(searchValue)" />
      </InputGroup>
      <Select :model-value="sortBy" @update:model-value="(v) => onSortByChange(String(v))">
        <SelectTrigger class="w-[140px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
        <SelectContent>
          <SelectItem v-for="o in sortByOptions" :key="o.value" :value="o.value">{{ o.label }}</SelectItem>
        </SelectContent>
      </Select>
      <Select :model-value="sortOrder" @update:model-value="(v) => onSortOrderChange(String(v))">
        <SelectTrigger class="w-[130px]"><SelectValue placeholder="Order" /></SelectTrigger>
        <SelectContent>
          <SelectItem v-for="o in sortOrderOptions" :key="o.value" :value="o.value">{{ o.label }}</SelectItem>
        </SelectContent>
      </Select>
      <ConfirmDialog
        v-if="hasSelected && can('todos:delete')"
        :title="`Delete ${selectedCount} selected todo(s)?`"
        confirm-label="Yes"
        destructive
        :loading="loading"
        @confirm="handleBulkDelete"
      >
        <Button variant="destructive"><Trash2 /> Delete Selected ({{ selectedCount }})</Button>
      </ConfirmDialog>
      <Button v-if="can('todos:create')" @click="openCreateModal"><Plus /> Create Todo</Button>
    </PageHeader>

    <div v-if="loading && todos.length === 0" class="space-y-2">
      <Skeleton v-for="n in 5" :key="n" class="h-10" />
    </div>

    <Empty v-else-if="!loading && todos.length === 0">
      <EmptyHeader>
        <EmptyTitle>{{ searchQuery ? "No todos match your search" : "No todos yet" }}</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button v-if="!searchQuery && can('todos:create')" @click="openCreateModal">Create your first todo</Button>
        <Button v-else-if="searchQuery" variant="outline" @click="clearSearch">Clear search</Button>
      </EmptyContent>
    </Empty>

    <template v-else>
      <div class="relative rounded-md border">
        <Spinner v-if="loading" class="absolute top-2 right-2" />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-10"><Checkbox :model-value="allSelected" aria-label="Select all" @update:model-value="(v) => toggleAll(v === true)" /></TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Description</TableHead>
              <TableHead class="w-[120px]">Status</TableHead>
              <TableHead class="w-[180px]">Updated</TableHead>
              <TableHead class="w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="todo in todos" :key="todo.id" :data-state="selectedIds.includes(todo.id) ? 'selected' : undefined">
              <TableCell><Checkbox :model-value="selectedIds.includes(todo.id)" :aria-label="`Select ${todo.title}`" @update:model-value="(v) => toggleOne(todo.id, v === true)" /></TableCell>
              <TableCell class="max-w-[280px] truncate">{{ todo.title }}</TableCell>
              <TableCell class="max-w-[320px] truncate">{{ todo.description || "-" }}</TableCell>
              <TableCell><Badge :variant="todo.is_completed ? 'success' : 'secondary'">{{ todo.is_completed ? "Completed" : "Pending" }}</Badge></TableCell>
              <TableCell>{{ new Date(todo.updated_at).toLocaleString() }}</TableCell>
              <TableCell>
                <div class="flex items-center gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label="View" @click="viewTodo(todo.id)"><Eye /></Button>
                  <Button v-if="can('todos:update')" variant="ghost" size="icon-sm" aria-label="Edit" @click="editTodo(todo.id)"><Pencil /></Button>
                  <ConfirmDialog v-if="can('todos:delete')" title="Delete this todo?" confirm-label="Yes" destructive @confirm="handleDelete(todo.id)">
                    <Button variant="ghost" size="icon-sm" class="text-destructive" aria-label="Delete"><Trash2 /></Button>
                  </ConfirmDialog>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-sm text-muted-foreground">{{ rangeText }}</span>
        <div class="flex items-center gap-2">
          <Select :model-value="String(pagination.items_per_page)" @update:model-value="onPageSizeChange">
            <SelectTrigger class="h-8 w-[90px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="size in PAGE_SIZES" :key="size" :value="String(size)">{{ size }} / page</SelectItem>
            </SelectContent>
          </Select>
          <Pagination :page="pagination.current_page" :total="pagination.total_items" :items-per-page="pagination.items_per_page" :sibling-count="1" show-edges @update:page="onPageChange">
            <PaginationContent v-slot="{ items }">
              <PaginationPrevious />
              <template v-for="(item, index) in items" :key="index">
                <PaginationItem v-if="item.type === 'page'" :value="item.value" :is-active="item.value === pagination.current_page">{{ item.value }}</PaginationItem>
                <PaginationEllipsis v-else :index="index" />
              </template>
              <PaginationNext />
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </template>

    <TodoFormModal :open="isModalVisible" :todo="editingTodo" :loading="loading" @submit="handleSubmit" @cancel="closeModal" />
  </div>
</template>
