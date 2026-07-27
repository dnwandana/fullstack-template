import { ApiProperty } from "@nestjs/swagger"
import type { Permission, Role } from "@fullstack/contracts"
import { toSnakeKeys } from "@shared/utils/to-snake-keys"
import type { RoleRow } from "../role-row"

export class PermissionResponse implements Permission {
  @ApiProperty({ format: "uuid" }) id!: string
  @ApiProperty() name!: string
  @ApiProperty() resource!: string
  @ApiProperty() action!: string
  @ApiProperty({ type: String, nullable: true }) description!: string | null
}

export class RoleResponse implements Role {
  @ApiProperty({ format: "uuid" }) id!: string
  @ApiProperty({ format: "uuid" }) org_id!: string
  @ApiProperty() name!: string
  @ApiProperty({ type: String, nullable: true }) description!: string | null
  @ApiProperty() is_system!: boolean
  @ApiProperty({ format: "date-time" }) created_at!: Date
  @ApiProperty({ format: "date-time" }) updated_at!: Date
  @ApiProperty({ type: [PermissionResponse] }) permissions!: PermissionResponse[]
}

// A role response is a composition, not a mapping: the snake_cased row plus a
// separately fetched permission list, joined here so the halves cannot drift apart.
export function toRoleResponse(row: RoleRow, permissions: PermissionResponse[]): RoleResponse {
  return { ...toSnakeKeys<RoleRow>(row), permissions }
}
