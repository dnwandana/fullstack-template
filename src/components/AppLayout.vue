<script setup>
import { computed } from "vue"
import { useRouter } from "vue-router"
import { Layout, Menu, Button, Space, Typography } from "ant-design-vue"
import { UnorderedListOutlined, LogoutOutlined, UserOutlined } from "@ant-design/icons-vue"
import { useAuthStore } from "@/stores/auth"

const router = useRouter()
const authStore = useAuthStore()

// Computed
const currentUser = computed(() => authStore.currentUser)

// Handle logout
function handleLogout() {
  authStore.logout()
  router.push("/login")
}

// Navigation
function navigateTo(path) {
  router.push(path)
}
</script>

<template>
  <Layout style="min-height: 100vh">
    <!-- Header -->
    <Layout.Header
      style="display: flex; align-items: center; justify-content: space-between; padding: 0 24px"
    >
      <div style="display: flex; align-items: center">
        <Typography.Title :level="4" style="color: white; margin: 0; margin-right: 24px">
          Todo App
        </Typography.Title>
        <Menu
          theme="dark"
          mode="horizontal"
          :selected-keys="[$route.path]"
          style="flex: 1; min-width: 120px"
        >
          <Menu.Item key="/todos" @click="navigateTo('/todos')">
            <UnorderedListOutlined />
            <span>Todos</span>
          </Menu.Item>
        </Menu>
      </div>

      <Space>
        <Space>
          <UserOutlined style="color: white" />
          <Typography.Text style="color: white">
            {{ currentUser?.username }}
          </Typography.Text>
        </Space>
        <Button type="text" @click="handleLogout" style="color: white">
          <template #icon>
            <LogoutOutlined />
          </template>
          Logout
        </Button>
      </Space>
    </Layout.Header>

    <!-- Content -->
    <Layout.Content style="padding: 24px; background: #f5f5f5">
      <div
        style="
          background: white;
          padding: 24px;
          min-height: calc(100vh - 64px - 70px - 48px);
          border-radius: 8px;
        "
      >
        <slot></slot>
      </div>
    </Layout.Content>

    <!-- Footer -->
    <Layout.Footer style="text-align: center">
      Todo App ©{{ new Date().getFullYear() }}
    </Layout.Footer>
  </Layout>
</template>
