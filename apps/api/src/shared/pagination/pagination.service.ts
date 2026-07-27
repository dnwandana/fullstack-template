import { Injectable } from "@nestjs/common"
import type { PaginationMeta } from "@fullstack/contracts"

@Injectable()
export class PaginationService {
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
