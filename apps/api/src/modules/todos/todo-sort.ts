/**
 * Single source of truth for todo sorting: the DTO's accepted values and the Prisma column
 * mapping both derive from it. Two hand-synced lists is how an unmapped `sort_by` reaches
 * Prisma as `orderBy: { undefined: ... }` — no validation error, just a wrong ordering.
 */
export const SORT_COLUMN = {
  updated_at: "updatedAt",
  title: "title",
} as const

export type TodoSortKey = keyof typeof SORT_COLUMN

/** The `sort_by` values `ListTodosDto` accepts, derived so the two cannot drift. */
export const TODO_SORTABLE = Object.keys(SORT_COLUMN) as TodoSortKey[]

/** `sort_by` has no default at the DTO layer, so `TodosService` falls back to this. */
export const DEFAULT_TODO_SORT: TodoSortKey = "updated_at"
