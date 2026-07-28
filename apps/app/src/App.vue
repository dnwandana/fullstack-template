<script setup lang="ts">
import { computed, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import { ConfigProvider } from "ant-design-vue"
import AppShell from "@/components/AppShell.vue"
import antdTheme from "@/theme/antd"

const route = useRoute()
const router = useRouter()

// Render nothing until the first navigation resolves. Until then `route` sits
// at vue-router's START_LOCATION (path "/") regardless of the real URL, so
// deciding the chrome from `route.path` here would mount the org-scoped shell
// on EVERY cold load — /login included. The shell's onMounted data calls then
// 401 while logged out, http.ts fails the refresh and hard-redirects to
// /login, and the reload re-enters the same race: an infinite loop. The guard
// already blocks the first navigation on initAuth's /auth/me, so nothing was
// visible during this window anyway.
const routerReady = ref(false)
router.isReady().then(() => (routerReady.value = true))

// Routes that render outside the shell. /invite/:id is public and reachable by
// someone with no session and no org, so a shell built from tenant context has
// nothing to show there.
const isChromeless = computed(
  () => route.path === "/login" || route.path === "/signup" || route.path.startsWith("/invite/"),
)
</script>

<template>
  <ConfigProvider :theme="antdTheme">
    <template v-if="routerReady">
      <RouterView v-if="isChromeless" />
      <AppShell v-else />
    </template>
  </ConfigProvider>
</template>
