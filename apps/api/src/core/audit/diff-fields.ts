/** The `changes` column shape: one entry per changed field. */
export type AuditChanges = Record<string, { from: unknown; to: unknown }>

/**
 * Compares the named keys of two snapshots and returns the changed ones, or null when
 * nothing changed. JSON comparison covers the scalar and id-array fields call sites pass;
 * the keys parameter is the whitelist — never pass secret fields (password hashes,
 * invitation tokens).
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  keys: readonly (string & keyof T)[],
): AuditChanges | null {
  const changes: AuditChanges = {}
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = { from: before[key], to: after[key] }
    }
  }
  return Object.keys(changes).length > 0 ? changes : null
}
