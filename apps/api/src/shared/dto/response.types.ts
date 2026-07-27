import type { PaginationMeta } from "@fullstack/contracts"

/** The wire shape `TransformInterceptor` emits; `data` is `null` for deletes. */
export interface Envelope<T> {
  message: string
  data: T | null
  pagination?: PaginationMeta
}

/** What a handler may return; the interceptor fills the rest of the envelope in. */
export interface Payload<T> {
  data?: T
  message?: string
  pagination?: PaginationMeta
}
