/**
 * RFC 9562 UUID: version 1-8, variant 10xx, plus the nil and max UUIDs. This is the pattern of
 * Nest's `ParseUUIDPipe` and of Zod's `z.uuid()`, so the guards, the pipes and the schemas accept
 * the same set of ids.
 */
export const UUID_REGEX =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i
/**
 * Narrow an unknown value to a canonical UUID string. The predicate return lets a guard check a
 * `req.params` id — `string | undefined` under `noUncheckedIndexedAccess` — once and use it as a
 * `string`, no non-null assertion; `typeof` is load-bearing, a missing param must return false.
 */
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_REGEX.test(value)
