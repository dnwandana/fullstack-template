import type { PaginationMeta } from "../pagination/pagination.types"

export interface Envelope<T> {
  message: string
  data: T | null
  pagination?: PaginationMeta
}

export interface Payload<T> {
  data?: T
  message?: string
  pagination?: PaginationMeta
}
