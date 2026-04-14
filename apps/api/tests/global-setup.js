/**
 * Vitest global setup — runs once before the entire test suite.
 *
 * Loads test environment, validates env vars, runs migrations,
 * truncates all tables, and seeds permissions (system data required by all tests).
 * Returns a teardown function that rolls back migrations and closes the DB connection.
 *
 * @module tests/global-setup
 */
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default async function setup() {
  // Load test environment variables
  dotenv.config({ path: path.resolve(__dirname, "../.env.test"), override: true })

  // Validate env (reuse the app's validator)
  const { default: validateEnv } = await import("../src/utils/validate-env.js")
  validateEnv()

  // Run migrations
  const { default: db } = await import("../src/config/database.js")
  await db.migrate.latest()

  // Truncate all tables (including permissions for a clean slate)
  await db.raw(
    "TRUNCATE TABLE invitations, todos, project_members, projects, org_members, role_permissions, roles, organizations, permissions, users CASCADE",
  )

  // Seed permissions (needed by all tests — persists across cleanAllTables calls)
  const { seedPermissions } = await import("./helpers.js")
  await seedPermissions()

  // Return teardown function
  return async () => {
    await db.migrate.rollback(undefined, true)
    await db.destroy()
  }
}
