// API responses keep the Express-era snake_case contract the SPA consumes.
type SnakeKey<S extends string> = S extends `${infer H}${infer T}`
  ? H extends Uppercase<H>
    ? H extends Lowercase<H> // digits/underscore: not letters, keep as-is
      ? `${H}${SnakeKey<T>}`
      : `_${Lowercase<H>}${SnakeKey<T>}`
    : `${H}${SnakeKey<T>}`
  : S

export type SnakeKeys<T> = { [K in keyof T as SnakeKey<K & string>]: T[K] }

/**
 * Rename a row's top-level camelCase keys to snake_case; values (`Date`s included) pass through
 * untouched. Shallow by design — `select` the fields you want and flatten relations first rather
 * than relying on this to walk nested objects.
 */
export function toSnakeKeys<T extends Record<string, unknown>>(row: T): SnakeKeys<T> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    out[key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = value
  }
  return out as SnakeKeys<T>
}
