export interface AuditLog {
  id: string
  org_id: string
  project_id: string | null
  actor_id: string | null
  actor_name: string
  actor_email: string | null
  action: string // free-form by design; the API owns the AuditAction union
  entity_type: string
  entity_id: string
  entity_name: string
  changes: Record<string, { from: unknown; to: unknown }> | null
  created_at: Date
}
