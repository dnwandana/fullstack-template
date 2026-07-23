<script setup>
/**
 * UserMenu — avatar dropdown with the signed-in user and a Logout action.
 *
 * Replaces AppLayout's loose UserOutlined icon, name text and Logout button.
 */

import { computed } from "vue"
import { useRouter } from "vue-router"
import { Dropdown, Menu, Avatar } from "ant-design-vue"
import { LogoutOutlined, UserOutlined } from "@ant-design/icons-vue"
import { useAuthStore } from "@/stores/auth"

const router = useRouter()
const authStore = useAuthStore()

const currentUser = computed(() => authStore.currentUser)

/** First letter of the display name, for the avatar. */
const initial = computed(() => currentUser.value?.name?.charAt(0)?.toUpperCase() ?? "")

/**
 * Sign out, then navigate.
 *
 * AWAIT is load-bearing: logout() clears the tenant permission caches, and
 * navigating first would race that clear. See 10b's task notes.
 */
async function handleLogout() {
  await authStore.logout()
  router.push({ name: "Login" })
}

defineExpose({ handleLogout })
</script>

<template>
  <Dropdown v-if="currentUser" trigger="click" placement="bottomRight">
    <button type="button" class="user-menu">
      <Avatar size="small">
        <template v-if="!initial" #icon><UserOutlined /></template>
        {{ initial }}
      </Avatar>
      <span class="user-menu__name">{{ currentUser.name }}</span>
    </button>

    <template #overlay>
      <Menu>
        <Menu.Item key="identity" disabled>
          <div class="user-menu__identity">
            <strong>{{ currentUser.name }}</strong>
            <span class="ds-mono">{{ currentUser.email }}</span>
          </div>
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item key="logout" @click="handleLogout">
          <LogoutOutlined />
          Logout
        </Menu.Item>
      </Menu>
    </template>
  </Dropdown>
</template>

<style scoped>
.user-menu {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  font: inherit;
  color: var(--text-primary);
}

.user-menu:hover {
  background: var(--gray-100);
}

.user-menu__name {
  font-weight: 600;
}

.user-menu__identity {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
