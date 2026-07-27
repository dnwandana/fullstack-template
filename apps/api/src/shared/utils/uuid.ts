export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/**
 * Narrow an unknown value to a canonical UUID string. The predicate return lets a guard check a
 * `req.params` id — `string | undefined` under `noUncheckedIndexedAccess` — once and use it as a
 * `string`, no non-null assertion; `typeof` is load-bearing, a missing param must return false.
 */
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_REGEX.test(value)
