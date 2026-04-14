/**
 * Seed: Test users.
 *
 * Creates 5 test users with deterministic UUIDs matching the original
 * seed data. All users share the password "secretpassword" (hashed
 * with Argon2). The email field is now populated for invitation flows.
 *
 * User IDs are preserved from the pre-multi-tenancy seeds so that
 * downstream seeds (org_members, project_members, todos) can reference
 * them reliably.
 *
 * @module seeds/02_users
 */

import { hashPassword } from "../../src/utils/argon2.js"

/**
 * Deterministic user UUIDs for cross-seed referencing.
 * These match the original single-tenant seed IDs.
 *
 * @type {Record<string, string>}
 */
export const USER_IDS = {
  john_doe: "de159aac-67ab-40bf-9234-2b55b10d23db",
  jane_doe: "e92c325c-9522-4f64-8e4d-c568c8323008",
  alex: "19e565d0-8dfb-4f32-a33f-fd61772aaf03",
  cloud: "2bcd8bf1-d4b7-4eaa-88fb-45bc90ad37a1",
  sudo_sam: "ce93fc37-71de-491f-98ea-6485d399370c",
}

/**
 * Seed the users table with 5 test users.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const seed = async (knex) => {
  if (process.env.NODE_ENV === "production")
    throw new Error("Seeding is not allowed in production")

  // Hash the shared test password once (Argon2 is CPU-intensive)
  const hashedPassword = await hashPassword("secretpassword")

  const users = [
    {
      id: USER_IDS.john_doe,
      username: "john.doe",
      email: "john.doe@acme.test",
      password: hashedPassword,
      created_at: "2025-01-15T09:00:00.000Z",
      updated_at: "2025-01-15T09:00:00.000Z",
    },
    {
      id: USER_IDS.jane_doe,
      username: "jane.doe",
      email: "jane.doe@acme.test",
      password: hashedPassword,
      created_at: "2025-01-18T14:30:00.000Z",
      updated_at: "2025-01-18T14:30:00.000Z",
    },
    {
      id: USER_IDS.alex,
      username: "AlexTheBuilder",
      email: "alex@builder.test",
      password: hashedPassword,
      created_at: "2025-01-20T10:15:00.000Z",
      updated_at: "2025-01-20T10:15:00.000Z",
    },
    {
      id: USER_IDS.cloud,
      username: "CloudArchitect",
      email: "cloud@globex.test",
      password: hashedPassword,
      created_at: "2025-01-22T16:45:00.000Z",
      updated_at: "2025-01-22T16:45:00.000Z",
    },
    {
      id: USER_IDS.sudo_sam,
      username: "sudo_sam",
      email: "sam@sudoers.test",
      password: hashedPassword,
      created_at: "2025-01-25T11:20:00.000Z",
      updated_at: "2025-01-25T11:20:00.000Z",
    },
  ]

  // Clear existing users and insert fresh data
  await knex("users").del()
  await knex("users").insert(users)
}
