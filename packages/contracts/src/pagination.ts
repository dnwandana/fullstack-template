export interface PaginationMeta {
  current_page: number
  total_pages: number
  total_items: number
  items_per_page: number
  has_next_page: boolean
  has_previous_page: boolean
  next_page: number | null
  previous_page: number | null
}
