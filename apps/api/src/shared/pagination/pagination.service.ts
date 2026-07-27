import { Injectable } from "@nestjs/common"
import type { PaginationMeta } from "@fullstack/contracts"

/** Builds the pagination meta block every paginated list endpoint returns beside its rows. */
@Injectable()
export class PaginationService {
  /**
   * Build the fixed meta block. The SPA reads these keys verbatim, so adding, renaming or dropping
   * one is a breaking client change; `next_page`/`previous_page` are `null` at the ends, never
   * omitted.
   */
  buildMeta(page: number, limit: number, totalItems: number): PaginationMeta {
    const totalPages = Math.ceil(totalItems / limit)
    const hasNext = page < totalPages
    const hasPrev = page > 1
    return {
      current_page: page,
      total_pages: totalPages,
      total_items: totalItems,
      items_per_page: limit,
      has_next_page: hasNext,
      has_previous_page: hasPrev,
      next_page: hasNext ? page + 1 : null,
      previous_page: hasPrev ? page - 1 : null,
    }
  }
}
