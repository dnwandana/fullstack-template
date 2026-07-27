// Single source of truth for todo sorting. Both the DTO's accepted values and the
// Prisma column mapping derive from this one object, so adding a sortable column
// updates validation and `orderBy` together. Two hand-synced lists is precisely how
// an unmapped `sort_by` reaches Prisma as `orderBy: { undefined: ... }` — which is
// not a validation error, just a silently wrong ordering.
export const SORT_COLUMN = {
  updated_at: "updatedAt",
  title: "title",
} as const

export type TodoSortKey = keyof typeof SORT_COLUMN

export const TODO_SORTABLE = Object.keys(SORT_COLUMN) as TodoSortKey[]

export const DEFAULT_TODO_SORT: TodoSortKey = "updated_at"
