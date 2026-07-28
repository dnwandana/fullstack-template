/**
 * The JSON-serialized view of a contract entity. Entities declare `Date` because that is the
 * API's in-memory shape (Prisma rows, serialized by Express). Over the wire those become ISO
 * strings, so the frontend consumes `Wire<Entity>` rather than the entity itself.
 *
 * Order matters: `Date` is an object, so its branch must precede the object branch.
 */
export type Wire<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Wire<U>[]
    : T extends object
      ? { [K in keyof T]: Wire<T[K]> }
      : T
