/**
 * Vue Router configuration with navigation guards for multi-tenant app.
 *
 * Route hierarchy:
 *   /orgs                                    — list organizations
 *   /orgs/:orgId                             — list projects within an org
 *   /orgs/:orgId/members                     — org members
 *   /orgs/:orgId/roles                       — org roles and permissions
 *   /orgs/:orgId/invitations                 — invitations sent for the org
 *   /orgs/:orgId/settings                    — org general settings
 *   /orgs/:orgId/projects/:projectId         — list todos within a project
 *   /orgs/:orgId/projects/:projectId/todos/:id — single todo detail
 *   /orgs/:orgId/projects/:projectId/members   — project members
 *   /orgs/:orgId/projects/:projectId/invitations — invitations for the project
 *   /orgs/:orgId/projects/:projectId/settings — project settings
 *   /invitations                             — current user's pending invitations
 *   /invite/:invitationId                    — public invite landing page (?token=)
 *
 * Auth behavior:
 *   - Routes with `requiresAuth` redirect unauthenticated users to /login.
 *   - Routes with `requiresGuest` redirect authenticated users to /orgs.
 *   - Routes with neither flag are public and reachable in any session state.
 *
 * Permissions:
 *   - `meta.permission` names the permission a route requires. SideNav hides
 *     nav items whose permission the user lacks. Route-level ENFORCEMENT is
 *     not implemented yet — the field is declarative in this release.
 */

import { createRouter, createWebHistory } from "vue-router"
import type { NavigationGuard, RouteRecordRaw } from "vue-router"
import { useAuthStore } from "@/stores/auth"

declare module "vue-router" {
  interface RouteMeta {
    /** Redirect unauthenticated users to /login. */
    requiresAuth?: boolean
    /** Redirect authenticated users to /orgs. */
    requiresGuest?: boolean
    /**
     * Permission name this route requires. SideNav hides nav items whose permission the user
     * lacks; route-level enforcement is not implemented — the field is declarative.
     */
    permission?: string
  }
}

/**
 * Build a `beforeEnter` guard that upgrades legacy `?tab=` links to real routes.
 *
 * A `redirect` function cannot do this: it must always return a location, but
 * `?tab=general` and unrecognised values have to fall through to the settings
 * page itself. Returning `undefined` from a guard is the only way to say
 * "proceed unchanged".
 */
function redirectLegacyTab(tabRoutes: Record<string, string>): NavigationGuard {
  return (to) => {
    // `to.query.tab` is `string | null | (string | null)[]` and cannot index a
    // `Record<string, string>`. The `""` fallback preserves today's behavior exactly:
    // indexing with `null` or with an array both yield `undefined`, and so does `""`.
    const tab = typeof to.query.tab === "string" ? to.query.tab : ""
    const target = tabRoutes[tab]
    if (target) {
      return { name: target, params: to.params }
    }
    if (to.query.tab) {
      // Recognised page, unrecognised tab: strip the query so the URL is clean.
      // The redirected navigation has no `tab`, so this guard no-ops second time.
      return { name: to.name, params: to.params, query: {} }
    }
  }
}

const routes: RouteRecordRaw[] = [
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
    meta: { requiresAuth: true, permission: "project:read" },
  },
  {
    path: "/orgs/:orgId/members",
    name: "OrgMembers",
    component: () => import("@/views/orgs/OrgMembersView.vue"),
    meta: { requiresAuth: true, permission: "org:read" },
  },
  {
    // Roles gate on org:read, not org:manage_roles — GET /orgs/:org_id/roles
    // requires only org:read (`RolesController.list` in apps/api, which carries
    // `@RequirePermission("org:read")`). Editing is gated separately,
    // in-template, on org:manage_roles.
    path: "/orgs/:orgId/roles",
    name: "OrgRoles",
    component: () => import("@/views/orgs/OrgRolesView.vue"),
    meta: { requiresAuth: true, permission: "org:read" },
  },
  {
    path: "/orgs/:orgId/invitations",
    name: "OrgInvitations",
    component: () => import("@/views/orgs/OrgInvitationsView.vue"),
    meta: { requiresAuth: true, permission: "invitations:manage" },
  },
  {
    path: "/orgs/:orgId/settings",
    name: "OrgSettings",
    component: () => import("@/views/settings/OrgSettingsView.vue"),
    meta: { requiresAuth: true, permission: "org:update" },
    beforeEnter: redirectLegacyTab({
      members: "OrgMembers",
      roles: "OrgRoles",
      invitations: "OrgInvitations",
    }),
  },

  // ── Project routes (scoped within an organization) ───────────────────
  {
    path: "/orgs/:orgId/projects/:projectId",
    name: "TodosList",
    component: () => import("@/views/todos/TodosListView.vue"),
    meta: { requiresAuth: true, permission: "todos:read" },
  },
  {
    path: "/orgs/:orgId/projects/:projectId/todos/:id",
    name: "TodoDetail",
    component: () => import("@/views/todos/TodoDetailView.vue"),
    meta: { requiresAuth: true, permission: "todos:read" },
  },
  {
    path: "/orgs/:orgId/projects/:projectId/members",
    name: "ProjectMembers",
    component: () => import("@/views/projects/ProjectMembersView.vue"),
    meta: { requiresAuth: true, permission: "project:read" },
  },
  {
    path: "/orgs/:orgId/projects/:projectId/invitations",
    name: "ProjectInvitations",
    component: () => import("@/views/projects/ProjectInvitationsView.vue"),
    meta: { requiresAuth: true, permission: "invitations:manage" },
  },
  {
    path: "/orgs/:orgId/projects/:projectId/settings",
    name: "ProjectSettings",
    component: () => import("@/views/settings/ProjectSettingsView.vue"),
    meta: { requiresAuth: true, permission: "project:update" },
    beforeEnter: redirectLegacyTab({
      members: "ProjectMembers",
      invitations: "ProjectInvitations",
    }),
  },

  // ── User invitations ────────────────────────────────────────────────
  {
    path: "/invitations",
    name: "MyInvitations",
    component: () => import("@/views/invitations/MyInvitationsView.vue"),
    meta: { requiresAuth: true },
  },

  // ── Public invite landing page ──────────────────────────────────────
  {
    path: "/invite/:invitationId",
    name: "InviteAccept",
    component: () => import("@/views/invitations/InviteAcceptView.vue"),
    // Deliberately public: neither requiresAuth nor requiresGuest.
    // requiresAuth would bounce brand-new invitees to /login before they can
    // see what they were invited to; requiresGuest would bounce signed-in
    // users to /orgs before they can accept.
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
router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  // Initialize auth state by verifying cookie validity on first navigation
  if (!authStore.user) {
    await authStore.initAuth()
  }

  const isAuthenticated = authStore.isAuthenticated

  // Protected routes — redirect unauthenticated users to login
  if (to.meta.requiresAuth && !isAuthenticated) {
    return { path: "/login", query: { redirect: to.fullPath } }
  }

  // Guest-only routes — redirect authenticated users to orgs list
  if (to.meta.requiresGuest && isAuthenticated) {
    return { path: "/orgs" }
  }
})

export default router
