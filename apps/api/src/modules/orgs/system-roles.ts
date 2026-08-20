// `project:read_all` makes cross-project visibility a grantable permission rather
// than a role-name special case: a custom role granted it behaves like owner/admin.
// Do not reintroduce role-name checks such as the old `ADMIN_ROLES` set.
export const ALL_PERMISSIONS = [
  "org:read",
  "org:update",
  "org:delete",
  "org:manage_members",
  "org:manage_roles",
  "project:create",
  "project:read",
  "project:read_all",
  "project:update",
  "project:delete",
  "project:manage_members",
  "todos:create",
  "todos:read",
  "todos:update",
  "todos:delete",
  "invitations:create",
  "invitations:manage",
  "audit:read",
]

/**
 * The four system roles minted for every org. `owner` is identified by this name,
 * not by a permission — the last-owner invariant in `members.service.ts` matches on it.
 */
export const SYSTEM_ROLE_NAMES = ["owner", "admin", "member", "viewer"] as const
export type SystemRoleName = (typeof SYSTEM_ROLE_NAMES)[number]

/**
 * `ALL_PERMISSIONS` here and `PERMISSION_NAMES` in `prisma/seed.ts` must hold the
 * same set of names. `__tests__/system-roles.spec.ts` compares the two sorted, so a
 * name present in only one fails the unit tier. Edit both in the same change.
 */
export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRoleName, string[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter((n) => n !== "org:delete" && n !== "org:manage_roles"),
  member: [
    "org:read",
    "project:read",
    "todos:create",
    "todos:read",
    "todos:update",
    "todos:delete",
  ],
  viewer: ["org:read", "project:read", "todos:read"],
}
