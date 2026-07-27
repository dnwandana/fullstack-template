import { ApiProperty } from "@nestjs/swagger"
import type { Org } from "@fullstack/contracts"
import { toSnakeKeys } from "@shared/utils/to-snake-keys"
import type { OrgRow } from "../org-row"

export class OrgResponse implements Org {
  @ApiProperty({ format: "uuid" }) id!: string
  @ApiProperty() name!: string
  @ApiProperty({ type: String, nullable: true }) description!: string | null
  @ApiProperty({ format: "uuid" }) created_by!: string
  @ApiProperty({ format: "date-time" }) created_at!: Date
  @ApiProperty({ format: "date-time" }) updated_at!: Date
}

// The return annotation is the guard: `toSnakeKeys<OrgRow>` produces
// `SnakeKeys<OrgRow>`, so widening ORG_SELECT without updating OrgResponse
// stops compiling here instead of silently changing the public API.
export function toOrgResponse(row: OrgRow): OrgResponse {
  return toSnakeKeys<OrgRow>(row)
}
