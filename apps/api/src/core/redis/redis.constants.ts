// A symbol, not a string: two providers cannot collide on it by accident, and a
// typo becomes a compile error instead of an unresolved-dependency error at boot.
export const REDIS_CLIENT = Symbol("REDIS_CLIENT")
