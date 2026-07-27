const ALL_PERMISSIONS = [
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
]

export const SYSTEM_ROLE_NAMES = ["owner", "admin", "member", "viewer"] as const
export type SystemRoleName = (typeof SYSTEM_ROLE_NAMES)[number]

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
