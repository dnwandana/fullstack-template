/**
 * Seed: System permissions.
 *
 * Inserts the 16 system-level permissions that define what actions
 * can be performed on each resource. These IDs are deterministic
 * so other seeds can reference them for role-permission mapping.
 *
 * Permission naming convention: `resource:action`
 *   - org:        organization-level operations
 *   - project:    project-level operations
 *   - todos:      todo item operations
 *   - invitations: invitation management
 *
 * @module seeds/01_permissions
 */

/**
 * Deterministic permission UUIDs for cross-seed referencing.
 * Pattern: a0000000-0000-0000-0000-00000000NNNN
 *
 * @type {Record<string, string>}
 */
export const PERMISSION_IDS = {
  // Organization permissions
  org_read: "a0000000-0000-0000-0000-000000000001",
  org_update: "a0000000-0000-0000-0000-000000000002",
  org_delete: "a0000000-0000-0000-0000-000000000003",
  org_manage_members: "a0000000-0000-0000-0000-000000000004",
  org_manage_roles: "a0000000-0000-0000-0000-000000000005",

  // Project permissions
  project_create: "a0000000-0000-0000-0000-000000000006",
  project_read: "a0000000-0000-0000-0000-000000000007",
  project_update: "a0000000-0000-0000-0000-000000000008",
  project_delete: "a0000000-0000-0000-0000-000000000009",
  project_manage_members: "a0000000-0000-0000-0000-000000000010",

  // Todo permissions
  todos_create: "a0000000-0000-0000-0000-000000000011",
  todos_read: "a0000000-0000-0000-0000-000000000012",
  todos_update: "a0000000-0000-0000-0000-000000000013",
  todos_delete: "a0000000-0000-0000-0000-000000000014",

  // Invitation permissions
  invitations_create: "a0000000-0000-0000-0000-000000000015",
  invitations_manage: "a0000000-0000-0000-0000-000000000016",
}

/**
 * Seed the permissions table with all 16 system permissions.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const seed = async (knex) => {
  if (process.env.NODE_ENV === "production")
    throw new Error("Seeding is not allowed in production")

  // All system permissions — one row per resource:action pair
  const permissions = [
    // ── Organization permissions ────────────────────────────────────
    {
      id: PERMISSION_IDS.org_read,
      name: "org:read",
      description: "View organization details and settings",
      resource: "org",
      action: "read",
    },
    {
      id: PERMISSION_IDS.org_update,
      name: "org:update",
      description: "Update organization name, description, and settings",
      resource: "org",
      action: "update",
    },
    {
      id: PERMISSION_IDS.org_delete,
      name: "org:delete",
      description: "Permanently delete the organization and all its data",
      resource: "org",
      action: "delete",
    },
    {
      id: PERMISSION_IDS.org_manage_members,
      name: "org:manage_members",
      description: "Add, remove, and change roles of organization members",
      resource: "org",
      action: "manage_members",
    },
    {
      id: PERMISSION_IDS.org_manage_roles,
      name: "org:manage_roles",
      description: "Create, update, and delete custom roles within the organization",
      resource: "org",
      action: "manage_roles",
    },

    // ── Project permissions ─────────────────────────────────────────
    {
      id: PERMISSION_IDS.project_create,
      name: "project:create",
      description: "Create new projects within the organization",
      resource: "project",
      action: "create",
    },
    {
      id: PERMISSION_IDS.project_read,
      name: "project:read",
      description: "View project details, members, and settings",
      resource: "project",
      action: "read",
    },
    {
      id: PERMISSION_IDS.project_update,
      name: "project:update",
      description: "Update project name, description, and settings",
      resource: "project",
      action: "update",
    },
    {
      id: PERMISSION_IDS.project_delete,
      name: "project:delete",
      description: "Permanently delete the project and all its todos",
      resource: "project",
      action: "delete",
    },
    {
      id: PERMISSION_IDS.project_manage_members,
      name: "project:manage_members",
      description: "Add, remove, and change roles of project members",
      resource: "project",
      action: "manage_members",
    },

    // ── Todo permissions ────────────────────────────────────────────
    {
      id: PERMISSION_IDS.todos_create,
      name: "todos:create",
      description: "Create new todo items within a project",
      resource: "todos",
      action: "create",
    },
    {
      id: PERMISSION_IDS.todos_read,
      name: "todos:read",
      description: "View todo items within a project",
      resource: "todos",
      action: "read",
    },
    {
      id: PERMISSION_IDS.todos_update,
      name: "todos:update",
      description: "Update todo title, description, and completion status",
      resource: "todos",
      action: "update",
    },
    {
      id: PERMISSION_IDS.todos_delete,
      name: "todos:delete",
      description: "Delete todo items from a project",
      resource: "todos",
      action: "delete",
    },

    // ── Invitation permissions ──────────────────────────────────────
    {
      id: PERMISSION_IDS.invitations_create,
      name: "invitations:create",
      description: "Send invitations to join the organization or a project",
      resource: "invitations",
      action: "create",
    },
    {
      id: PERMISSION_IDS.invitations_manage,
      name: "invitations:manage",
      description: "View, resend, and revoke pending invitations",
      resource: "invitations",
      action: "manage",
    },
  ]

  // Clear existing permissions and insert fresh data
  await knex("permissions").del()
  await knex("permissions").insert(permissions)
}
