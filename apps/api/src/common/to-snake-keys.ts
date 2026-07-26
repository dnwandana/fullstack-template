// API responses keep the Express-era snake_case contract the SPA consumes.
// Shallow by design: services shape their rows explicitly (selects + relation
// flattening) before mapping, and Date values must pass through untouched.
type SnakeKey<S extends string> = S extends `${infer H}${infer T}`
  ? H extends Uppercase<H>
    ? H extends Lowercase<H> // digits/underscore: not letters, keep as-is
      ? `${H}${SnakeKey<T>}`
      : `_${Lowercase<H>}${SnakeKey<T>}`
    : `${H}${SnakeKey<T>}`
  : S

export type SnakeKeys<T> = { [K in keyof T as SnakeKey<K & string>]: T[K] }

export function toSnakeKeys<T extends Record<string, unknown>>(row: T): SnakeKeys<T> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    out[key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = value
  }
  return out as SnakeKeys<T>
}
