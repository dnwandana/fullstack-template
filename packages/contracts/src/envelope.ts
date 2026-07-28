import type { PaginationMeta } from "./pagination"

/** The success envelope `TransformInterceptor` emits. */
export interface Envelope<T> {
  message: string
  data: T
  pagination?: PaginationMeta
}

/** A list endpoint's envelope: `pagination` is always present, never optional. */
export type PaginatedEnvelope<T> = Envelope<T> & { pagination: PaginationMeta }

/** The error envelope `AllExceptionsFilter` writes. `data` is always null. */
export interface ErrorEnvelope {
  message: string
  data: null
  request_id: string | null
}
