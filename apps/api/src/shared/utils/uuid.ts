export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// A type predicate, not a plain boolean: callers read ids straight off `req.params`,
// which `noUncheckedIndexedAccess` types as `string | undefined`. Returning
// `value is string` is what lets a guard validate once and use the id as a `string`
// afterwards, instead of asserting non-null. The `typeof` check is therefore
// load-bearing — a missing param arrives as `undefined` and must return false.
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_REGEX.test(value)
