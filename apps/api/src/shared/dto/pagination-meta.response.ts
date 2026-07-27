import { ApiProperty } from "@nestjs/swagger"
import type { PaginationMeta } from "@fullstack/contracts"

// `implements` is load-bearing: PaginationMeta stays the single definition and this class fails to
// compile if it gains a field. The class exists at all because interfaces erase, leaving the
// Swagger plugin no runtime type to describe.
export class PaginationMetaResponse implements PaginationMeta {
  @ApiProperty() current_page!: number
  @ApiProperty() total_pages!: number
  @ApiProperty() total_items!: number
  @ApiProperty() items_per_page!: number
  @ApiProperty() has_next_page!: boolean
  @ApiProperty() has_previous_page!: boolean
  @ApiProperty({ type: Number, nullable: true }) next_page!: number | null
  @ApiProperty({ type: Number, nullable: true }) previous_page!: number | null
}
