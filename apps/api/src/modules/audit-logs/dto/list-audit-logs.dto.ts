import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from "class-validator"
import { ApiPropertyOptional } from "@nestjs/swagger"
import { PaginationQueryDto } from "@shared/pagination/pagination.dto"

// `page`, `limit`, `sort_order` and `search` come from the parent — do not redeclare them.
export class ListAuditLogsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Filter by project id" })
  @IsOptional()
  @IsUUID()
  project_id?: string

  @ApiPropertyOptional({ description: "Filter by actor user id" })
  @IsOptional()
  @IsUUID()
  actor_id?: string

  @ApiPropertyOptional({ description: "Filter by exact action, e.g. todo.created" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  action?: string

  @ApiPropertyOptional({ description: "Filter by entity type, e.g. todo" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  entity_type?: string

  @ApiPropertyOptional({ description: "Entries at or after this ISO 8601 instant" })
  @IsOptional()
  @IsISO8601()
  date_from?: string

  @ApiPropertyOptional({ description: "Entries at or before this ISO 8601 instant" })
  @IsOptional()
  @IsISO8601()
  date_to?: string
}
