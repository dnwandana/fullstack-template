/**
 * Test helper utilities for integration tests.
 *
 * Provides factory functions for creating test users, organizations, projects,
 * and memberships. All helpers operate directly on the database, bypassing
 * the API layer for faster, more isolated setup.
 *
 * @module tests/helpers
 */
import crypto from "node:crypto"
import supertest from "supertest"

let app

/**
 * Lazily imports and caches the Express app instance.
 * Uses dynamic import so the app is only loaded when tests actually run.
 *
 * @returns {Promise<import("express").Express>} The Express app
 */
export async function getApp() {
  if (!app) {
    const mod = await import("../src/app.js")
    app = mod.default
  }
  return app
}

/**
 * Creates a Supertest agent bound to the Express app.
 *
 * @returns {Promise<import("supertest").SuperTest>} Supertest agent
 */
export async function request() {
  const app = await getApp()
  return supertest(app)
}

/**
 * Creates a test user directly in the database.
 *
 * @param {Object} [overrides={}] - Override default values
 * @param {string} [overrides.username] - Custom username
 * @param {string} [overrides.email] - Custom email
 * @param {string} [overrides.password] - Custom plaintext password
 * @returns {Promise<Object>} User object with id, username, email, and plainPassword
 */
export async function createTestUser(overrides = {}) {
  const { hashPassword } = await import("../src/utils/argon2.js")
  const { default: db } = await import("../src/config/database.js")

  const id = crypto.randomUUID()
  const username = overrides.username || `testuser_${id.slice(0, 8)}`
  const email = overrides.email || `${username}@test.com`
  const password = overrides.password || "testpassword123"
  const hashedPassword = await hashPassword(password)

  const [user] = await db("users")
    .insert({
      id,
      username,
      email,
      password: hashedPassword,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(["id", "username", "email", "created_at", "updated_at"])

  return { ...user, plainPassword: password }
}

/**
 * Generates auth headers (access + refresh tokens) for a given user ID.
 *
 * @param {string} userId - UUID of the user
 * @returns {Promise<Object>} Headers object with x-access-token and x-refresh-token
 */
export async function getAuthHeaders(userId) {
  const { generateAccessToken, generateRefreshToken } = await import("../src/utils/jwt.js")
  return {
    "x-access-token": generateAccessToken(userId),
    "x-refresh-token": generateRefreshToken(userId),
  }
}

/**
 * Creates a test organization with system roles and adds the creator as owner.
 *
 * Creates all four system roles (owner, admin, member, viewer) with their
 * corresponding permissions, mirroring the createOrg controller logic.
 *
 * @param {string} userId - UUID of the user to be the org owner
 * @param {Object} [overrides={}] - Override default values
 * @param {string} [overrides.name] - Custom org name
 * @param {string} [overrides.description] - Custom description
 * @returns {Promise<Object>} Org object with id, name, description, and roles map
 */
export async function createTestOrg(userId, overrides = {}) {
  const { default: db } = await import("../src/config/database.js")

  const orgId = crypto.randomUUID()
  const name = overrides.name || `Test Org ${orgId.slice(0, 8)}`

  const [org] = await db("organizations")
    .insert({
      id: orgId,
      name,
      description: overrides.description || null,
      created_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning("*")

  // Create system roles with mapped permissions
  const allPermissions = await db.select("id", "name").from("permissions")
  const permissionMap = {}
  for (const p of allPermissions) {
    permissionMap[p.name] = p.id
  }

  const allPermIds = Object.values(permissionMap)
  const roleDefinitions = {
    owner: allPermIds,
    admin: allPermIds.filter(
      (id) => id !== permissionMap["org:delete"] && id !== permissionMap["org:manage_roles"],
    ),
    member: [
      permissionMap["org:read"],
      permissionMap["project:read"],
      permissionMap["todos:create"],
      permissionMap["todos:read"],
      permissionMap["todos:update"],
      permissionMap["todos:delete"],
    ],
    viewer: [permissionMap["org:read"], permissionMap["project:read"], permissionMap["todos:read"]],
  }

  const roles = {}
  for (const [roleName, permIds] of Object.entries(roleDefinitions)) {
    const roleId = crypto.randomUUID()
    roles[roleName] = roleId
    await db("roles").insert({
      id: roleId,
      org_id: orgId,
      name: roleName,
      description: `System ${roleName} role`,
      is_system: true,
      created_at: new Date(),
      updated_at: new Date(),
    })

    if (permIds.length > 0) {
      await db("role_permissions").insert(
        permIds.map((permId) => ({ role_id: roleId, permission_id: permId })),
      )
    }
  }

  // Add creator as owner
  await db("org_members").insert({
    user_id: userId,
    org_id: orgId,
    role_id: roles.owner,
  })

  return { ...org, roles }
}

/**
 * Creates a test project within an organization and adds the creator as a member.
 *
 * @param {string} orgId - UUID of the organization
 * @param {string} userId - UUID of the user creating the project
 * @param {string} roleId - UUID of the role to assign the creator in this project
 * @param {Object} [overrides={}] - Override default values
 * @returns {Promise<Object>} Project object with id, org_id, name, description
 */
export async function createTestProject(orgId, userId, roleId, overrides = {}) {
  const { default: db } = await import("../src/config/database.js")

  const projectId = crypto.randomUUID()
  const name = overrides.name || `Test Project ${projectId.slice(0, 8)}`

  const [project] = await db("projects")
    .insert({
      id: projectId,
      org_id: orgId,
      name,
      description: overrides.description || null,
      created_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning("*")

  // Add creator as project member
  await db("project_members").insert({
    user_id: userId,
    project_id: projectId,
    role_id: roleId,
  })

  return project
}

/**
 * Adds a user as an organization member with a specific role.
 *
 * @param {string} orgId - UUID of the organization
 * @param {string} userId - UUID of the user
 * @param {string} roleId - UUID of the role
 */
export async function addOrgMember(orgId, userId, roleId) {
  const { default: db } = await import("../src/config/database.js")
  await db("org_members").insert({ user_id: userId, org_id: orgId, role_id: roleId })
}

/**
 * Adds a user as a project member with a specific role.
 *
 * @param {string} projectId - UUID of the project
 * @param {string} userId - UUID of the user
 * @param {string} roleId - UUID of the role
 */
export async function addProjectMember(projectId, userId, roleId) {
  const { default: db } = await import("../src/config/database.js")
  await db("project_members").insert({ user_id: userId, project_id: projectId, role_id: roleId })
}

/**
 * Truncates a single table with CASCADE.
 *
 * @param {string} tableName - Name of the table to truncate
 */
export async function cleanTable(tableName) {
  const { default: db } = await import("../src/config/database.js")
  await db.raw(`TRUNCATE TABLE ${tableName} CASCADE`)
}

/**
 * Truncates all application tables in the correct dependency order.
 * Preserves the permissions table since it's seeded once in global setup.
 */
export async function cleanAllTables() {
  const { default: db } = await import("../src/config/database.js")
  await db.raw(
    "TRUNCATE TABLE invitations, todos, project_members, projects, org_members, role_permissions, roles, organizations, users CASCADE",
  )
}

/**
 * Seeds the permissions table if not already populated.
 * Called once in global setup — permissions are immutable system data
 * that persist across test runs (not truncated by cleanAllTables).
 */
export async function seedPermissions() {
  const { default: db } = await import("../src/config/database.js")
  const existing = await db("permissions").count("* as count").first()
  if (parseInt(existing.count) > 0) return

  const permissionDefs = [
    { resource: "org", action: "read" },
    { resource: "org", action: "update" },
    { resource: "org", action: "delete" },
    { resource: "org", action: "manage_members" },
    { resource: "org", action: "manage_roles" },
    { resource: "project", action: "create" },
    { resource: "project", action: "read" },
    { resource: "project", action: "update" },
    { resource: "project", action: "delete" },
    { resource: "project", action: "manage_members" },
    { resource: "todos", action: "create" },
    { resource: "todos", action: "read" },
    { resource: "todos", action: "update" },
    { resource: "todos", action: "delete" },
    { resource: "invitations", action: "create" },
    { resource: "invitations", action: "manage" },
  ]

  const permissions = permissionDefs.map((def) => ({
    id: crypto.randomUUID(),
    name: `${def.resource}:${def.action}`,
    description: `${def.action} ${def.resource}`,
    resource: def.resource,
    action: def.action,
    created_at: new Date(),
  }))

  await db("permissions").insert(permissions)
}
