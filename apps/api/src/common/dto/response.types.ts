export interface Envelope<T> {
  message: string
  data: T | null
  pagination?: unknown
}

export interface Payload<T> {
  data?: T
  message?: string
  pagination?: unknown
}
