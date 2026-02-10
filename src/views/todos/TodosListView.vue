<script setup>
import { onMounted, ref } from "vue"
import { useRouter } from "vue-router"
import {
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Popconfirm,
  Select,
  Empty,
  Skeleton,
  Input,
} from "ant-design-vue"
import { PlusOutlined, DeleteOutlined, EditOutlined, EyeOutlined } from "@ant-design/icons-vue"
import { useTodos } from "@/composables/useTodos"
import TodoFormModal from "@/components/TodoFormModal.vue"

const router = useRouter()
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
  handlePageSizeChange,
  handleSortChange,
  handleSearch,
  handleSelectionChange,
  searchQuery,
} = useTodos()

// Table columns
const columns = [
  {
    title: "Title",
    dataIndex: "title",
    key: "title",
    ellipsis: true,
  },
  {
    title: "Description",
    dataIndex: "description",
    key: "description",
    ellipsis: true,
    customRender: ({ text }) => text || "-",
  },
  {
    title: "Status",
    dataIndex: "is_completed",
    key: "is_completed",
    width: 120,
    customRender: ({ record }) =>
      record.is_completed
        ? h(Tag, { color: "success" }, () => "Completed")
        : h(Tag, { color: "default" }, () => "Pending"),
  },
  {
    title: "Updated",
    dataIndex: "updated_at",
    key: "updated_at",
    width: 180,
    customRender: ({ text }) => new Date(text).toLocaleString(),
  },
  {
    title: "Actions",
    key: "actions",
    width: 150,
    fixed: "right",
  },
]

// Row selection config
const rowSelection = {
  selectedRowKeys: selectedIds,
  onChange: handleSelectionChange,
}

// Sort options
const sortByOptions = [
  { value: "updated_at", label: "Updated At" },
  { value: "title", label: "Title" },
]

const sortOrderOptions = [
  { value: "desc", label: "Descending" },
  { value: "asc", label: "Ascending" },
]

// View todo detail
function viewTodo(id) {
  router.push(`/todos/${id}`)
}

// Handle delete with confirmation
async function handleDelete(id) {
  await deleteTodo(id)
}

// Handle bulk delete
async function handleBulkDelete() {
  await bulkDelete()
}

// Search input value (local ref for two-way binding)
const searchValue = ref("")

function onSearch(value) {
  handleSearch(value)
}

function clearSearch() {
  searchValue.value = ""
  handleSearch("")
}

// Handle sort by change
function onSortByChange(value) {
  handleSortChange(value, sortOrder.value)
}

// Handle sort order change
function onSortOrderChange(value) {
  handleSortChange(sortBy.value, value)
}

// Fetch todos on mount
onMounted(() => {
  fetchTodos()
})

import { h } from "vue"
</script>

<template>
  <div class="todos-list">
    <!-- Header -->
    <div class="header">
      <Typography.Title :level="4" style="margin: 0"> My Todos </Typography.Title>

      <Space>
        <!-- Search -->
        <Input.Search
          v-model:value="searchValue"
          placeholder="Search todos..."
          allow-clear
          style="width: 250px"
          @search="onSearch"
        />

        <!-- Sort controls -->
        <Select
          :value="sortBy"
          :options="sortByOptions"
          style="width: 140px"
          placeholder="Sort by"
          @change="onSortByChange"
        />
        <Select
          :value="sortOrder"
          :options="sortOrderOptions"
          style="width: 130px"
          placeholder="Order"
          @change="onSortOrderChange"
        />

        <!-- Bulk delete -->
        <Popconfirm
          v-if="hasSelected"
          :title="`Delete ${selectedCount} selected todo(s)?`"
          ok-text="Yes"
          cancel-text="No"
          @confirm="handleBulkDelete"
        >
          <Button danger :loading="loading">
            <template #icon>
              <DeleteOutlined />
            </template>
            Delete Selected ({{ selectedCount }})
          </Button>
        </Popconfirm>

        <!-- Create button -->
        <Button type="primary" @click="openCreateModal">
          <template #icon>
            <PlusOutlined />
          </template>
          Create Todo
        </Button>
      </Space>
    </div>

    <!-- Loading skeleton -->
    <Skeleton v-if="loading && todos.length === 0" active :paragraph="{ rows: 5 }" />

    <!-- Empty state -->
    <Empty
      v-else-if="!loading && todos.length === 0"
      :description="searchQuery ? 'No todos match your search' : 'No todos yet'"
    >
      <Button v-if="!searchQuery" type="primary" @click="openCreateModal">
        Create your first todo
      </Button>
      <Button v-else type="default" @click="clearSearch"> Clear search </Button>
    </Empty>

    <!-- Table -->
    <Table
      v-else
      :columns="columns"
      :data-source="todos"
      :row-key="(record) => record.id"
      :row-selection="rowSelection"
      :loading="loading"
      :pagination="{
        current: pagination.current_page,
        pageSize: pagination.items_per_page,
        total: pagination.total_items,
        showSizeChanger: true,
        showTotal: (total) => `Total ${total} items`,
        onChange: handlePageChange,
        onShowSizeChange: handlePageSizeChange,
      }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'actions'">
          <Space>
            <Button type="text" size="small" @click="viewTodo(record.id)">
              <template #icon>
                <EyeOutlined />
              </template>
            </Button>
            <Button type="text" size="small" @click="openEditModal(record)">
              <template #icon>
                <EditOutlined />
              </template>
            </Button>
            <Popconfirm
              title="Delete this todo?"
              ok-text="Yes"
              cancel-text="No"
              @confirm="handleDelete(record.id)"
            >
              <Button type="text" size="small" danger>
                <template #icon>
                  <DeleteOutlined />
                </template>
              </Button>
            </Popconfirm>
          </Space>
        </template>
      </template>
    </Table>

    <!-- Todo Form Modal -->
    <TodoFormModal
      :visible="isModalVisible"
      :todo="editingTodo"
      :loading="loading"
      @submit="handleSubmit"
      @cancel="closeModal"
    />
  </div>
</template>

<style scoped>
.todos-list {
  width: 100%;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}
</style>
