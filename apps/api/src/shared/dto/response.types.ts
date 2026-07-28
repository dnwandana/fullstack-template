import type { Envelope as WireEnvelope, PaginationMeta } from "@fullstack/contracts"

/**
 * The wire shape `TransformInterceptor` emits. Contracts declare `data` as non-nullable because
 * each frontend call site knows its own endpoint; the interceptor must describe every endpoint at
 * once, so it instantiates the same type at `T | null` — `data` is `null` for deletes.
 */
export type Envelope<T> = WireEnvelope<T | null>

/** What a handler may return; the interceptor fills the rest of the envelope in. */
export interface Payload<T> {
  data?: T
  message?: string
  pagination?: PaginationMeta
}
