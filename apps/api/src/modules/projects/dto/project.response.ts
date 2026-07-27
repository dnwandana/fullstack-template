import { ApiProperty } from "@nestjs/swagger"
import type { Project } from "@fullstack/contracts"
import { toSnakeKeys } from "@shared/utils/to-snake-keys"
import type { ProjectRow } from "../project-row"

export class ProjectResponse implements Project {
  @ApiProperty({ format: "uuid" }) id!: string
  @ApiProperty({ format: "uuid" }) org_id!: string
  @ApiProperty() name!: string
  @ApiProperty({ type: String, nullable: true }) description!: string | null
  @ApiProperty({ format: "uuid" }) created_by!: string
  @ApiProperty({ format: "date-time" }) created_at!: Date
  @ApiProperty({ format: "date-time" }) updated_at!: Date
}

// The return annotation is the guard: `toSnakeKeys<ProjectRow>` produces
// `SnakeKeys<ProjectRow>`, so widening PROJECT_SELECT without updating
// ProjectResponse stops compiling here instead of silently changing the public API.
export function toProjectResponse(row: ProjectRow): ProjectResponse {
  return toSnakeKeys<ProjectRow>(row)
}
