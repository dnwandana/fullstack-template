<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'

const route = useRoute()

// Check if current route is an auth page
const isAuthPage = computed(() => {
  return route.path === '/login' || route.path === '/signup'
})
</script>

<template>
  <!-- Auth pages without layout -->
  <RouterView v-if="isAuthPage" />

  <!-- Protected pages with layout -->
  <AppLayout v-else>
    <RouterView />
  </AppLayout>
</template>
