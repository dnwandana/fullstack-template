import type { AuditChanges } from "./diff-fields"

// The API owns this union; contracts is type-only and cannot export a runtime list,
// so the SPA keeps its own display map and falls back to the raw string.
export type AuditAction =
  | "org.created"
  | "org.updated"
  | "org.deleted"
  | "project.created"
  | "project.updated"
  | "project.deleted"
  | "todo.created"
  | "todo.updated"
  | "todo.deleted"
  | "role.created"
  | "role.updated"
  | "role.deleted"
  | "member.added"
  | "member.role_changed"
  | "member.removed"
  | "invitation.created"
  | "invitation.resent"
  | "invitation.revoked"
  | "invitation.accepted"
  | "invitation.declined"

export type AuditEntityType = "org" | "project" | "todo" | "role" | "member" | "invitation"

export interface AuditEvent {
  orgId: string
  projectId?: string | null
  actorId: string | null
  action: AuditAction
  entityType: AuditEntityType
  entityId: string
  entityName: string
  changes?: AuditChanges | null
}
