/**
 * Vue Router configuration with auth guards
 */

import { createRouter, createWebHistory } from "vue-router"
import { useAuthStore } from "@/stores/auth"

// Route definitions
const routes = [
  // Auth routes (public)
  {
    path: "/login",
    name: "Login",
    component: () => import("@/views/auth/LoginView.vue"),
    meta: { requiresGuest: true },
  },
  {
    path: "/signup",
    name: "Signup",
    component: () => import("@/views/auth/SignupView.vue"),
    meta: { requiresGuest: true },
  },

  // Protected routes
  {
    path: "/",
    redirect: "/todos",
  },
  {
    path: "/todos",
    name: "TodosList",
    component: () => import("@/views/todos/TodosListView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/todos/:id",
    name: "TodoDetail",
    component: () => import("@/views/todos/TodoDetailView.vue"),
    meta: { requiresAuth: true },
  },

  // Catch all - redirect to todos
  {
    path: "/:pathMatch(.*)*",
    redirect: "/todos",
  },
]

// Create router instance
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// Navigation guard
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  // Initialize auth state if not already done
  if (!authStore.user) {
    authStore.initAuth()
  }

  const isAuthenticated = authStore.isAuthenticated

  // Protected routes - redirect to login if not authenticated
  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ path: "/login", query: { redirect: to.fullPath } })
    return
  }

  // Guest routes - redirect to todos if already authenticated
  if (to.meta.requiresGuest && isAuthenticated) {
    next({ path: "/todos" })
    return
  }

  next()
})

export default router
