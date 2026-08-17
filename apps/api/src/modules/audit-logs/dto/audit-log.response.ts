import { ApiProperty } from "@nestjs/swagger"
import type { AuditLog } from "@fullstack/contracts"
import { toSnakeKeys } from "@shared/utils/to-snake-keys"
import type { AuditLogRow } from "../audit-log-row"

export class AuditLogResponse implements AuditLog {
  @ApiProperty({ format: "uuid" }) id!: string
  @ApiProperty({ format: "uuid" }) org_id!: string
  @ApiProperty({ type: String, nullable: true }) project_id!: string | null
  @ApiProperty({ type: String, nullable: true }) actor_id!: string | null
  @ApiProperty() actor_name!: string
  @ApiProperty({ type: String, nullable: true }) actor_email!: string | null
  @ApiProperty() action!: string
  @ApiProperty() entity_type!: string
  @ApiProperty({ format: "uuid" }) entity_id!: string
  @ApiProperty() entity_name!: string
  @ApiProperty({ type: Object, nullable: true })
  changes!: Record<string, { from: unknown; to: unknown }> | null
  @ApiProperty({ format: "date-time" }) created_at!: Date
}

// The return annotation is the guard: widening AUDIT_LOG_SELECT without updating
// AuditLogResponse stops compiling here instead of silently changing the public API.
export function toAuditLogResponse(row: AuditLogRow): AuditLogResponse {
  const mapped = toSnakeKeys<AuditLogRow>(row)
  return {
    ...mapped,
    // Prisma types the Json column as JsonValue. AuditService is the only writer and
    // constrains the shape to AuditChanges, so this narrowing is safe.
    changes: row.changes as AuditLog["changes"],
  }
}
