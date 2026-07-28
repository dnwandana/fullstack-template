/**
 * Narrow a route param to a single string. vue-router types params as
 * `string | string[]` because repeatable segments (`:id+`) yield arrays; this app declares none,
 * so the array branch never runs — it exists to narrow without an assertion.
 */
export function paramToString(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}
