/**
 * Vue Router configuration with navigation guards for multi-tenant app.
 *
 * Route hierarchy:
 *   /orgs                                    — list organizations
 *   /orgs/:orgId                             — list projects within an org
 *   /orgs/:orgId/settings                    — org settings (members, roles, invitations)
 *   /orgs/:orgId/projects/:projectId         — list todos within a project
 *   /orgs/:orgId/projects/:projectId/todos/:id — single todo detail
 *   /orgs/:orgId/projects/:projectId/settings — project settings
 *   /invitations                             — current user's pending invitations
 *
 * Auth behavior:
 *   - Routes with `requiresAuth` redirect unauthenticated users to /login.
 *   - Routes with `requiresGuest` redirect authenticated users to /orgs.
 */

import { createRouter, createWebHistory } from "vue-router"
import { useAuthStore } from "@/stores/auth"

/** @type {import('vue-router').RouteRecordRaw[]} */
const routes = [
  // ── Auth routes (public / guest-only) ────────────────────────────────
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

  // ── Default redirect ─────────────────────────────────────────────────
  {
    path: "/",
    redirect: "/orgs",
  },

  // ── Organization routes ──────────────────────────────────────────────
  {
    path: "/orgs",
    name: "OrgsList",
    component: () => import("@/views/orgs/OrgsListView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/orgs/:orgId",
    name: "ProjectsList",
    component: () => import("@/views/projects/ProjectsListView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/orgs/:orgId/settings",
    name: "OrgSettings",
    component: () => import("@/views/settings/OrgSettingsView.vue"),
    meta: { requiresAuth: true },
  },

  // ── Project routes (scoped within an organization) ───────────────────
  {
    path: "/orgs/:orgId/projects/:projectId",
    name: "TodosList",
    component: () => import("@/views/todos/TodosListView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/orgs/:orgId/projects/:projectId/todos/:id",
    name: "TodoDetail",
    component: () => import("@/views/todos/TodoDetailView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/orgs/:orgId/projects/:projectId/settings",
    name: "ProjectSettings",
    component: () => import("@/views/settings/ProjectSettingsView.vue"),
    meta: { requiresAuth: true },
  },

  // ── User invitations ────────────────────────────────────────────────
  {
    path: "/invitations",
    name: "MyInvitations",
    component: () => import("@/views/invitations/MyInvitationsView.vue"),
    meta: { requiresAuth: true },
  },

  // ── Catch-all — redirect unknown paths to organizations list ────────
  {
    path: "/:pathMatch(.*)*",
    redirect: "/orgs",
  },
]

// Create router instance with HTML5 history mode
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

/**
 * Global navigation guard.
 * - Initializes the auth store on first navigation if needed.
 * - Enforces `requiresAuth` and `requiresGuest` meta flags.
 */
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  // Initialize auth state by verifying cookie validity on first navigation
  if (!authStore.user) {
    await authStore.initAuth()
  }

  const isAuthenticated = authStore.isAuthenticated

  // Protected routes — redirect unauthenticated users to login
  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ path: "/login", query: { redirect: to.fullPath } })
    return
  }

  // Guest-only routes — redirect authenticated users to orgs list
  if (to.meta.requiresGuest && isAuthenticated) {
    next({ path: "/orgs" })
    return
  }

  next()
})

export default router
