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

// The return annotation catches a narrowing only: drop a field from ORG_SELECT and this stops
// compiling. Adding one does not stop compiling, because the return value is not an object
// literal, so no excess property check runs. The key-set test in __tests__/org.response.spec.ts
// is what catches an added field.
export function toOrgResponse(row: OrgRow): OrgResponse {
  return toSnakeKeys<OrgRow>(row)
}
