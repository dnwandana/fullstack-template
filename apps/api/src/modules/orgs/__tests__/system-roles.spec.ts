import { ALL_PERMISSIONS, SYSTEM_ROLE_PERMISSIONS } from "../system-roles"
import { PERMISSION_NAMES } from "../../../../prisma/seed"

describe("ALL_PERMISSIONS", () => {
  // The seed inserts PERMISSION_NAMES. system-roles.ts grants ALL_PERMISSIONS. A name in
  // one list and not the other seeds without error and then never grants, so compare the
  // two lists. Sort both first: the invariant is the set of names, not their order, and
  // nothing reads either list by index.
  it("holds exactly the permission names the seed inserts", () => {
    expect([...ALL_PERMISSIONS].toSorted()).toEqual([...PERMISSION_NAMES].toSorted())
  })
})

describe("SYSTEM_ROLE_PERMISSIONS", () => {
  // `owner` aliases ALL_PERMISSIONS and `admin` filters it, so the compiler covers both.
  // `member` and `viewer` are hand-written literals typed only as string, so a typo such as
  // "todos:reed" compiles, seeds, and then never grants. Check every name against the list.
  it.each(Object.keys(SYSTEM_ROLE_PERMISSIONS))("grants %s only known permissions", (role) => {
    const granted = SYSTEM_ROLE_PERMISSIONS[role as keyof typeof SYSTEM_ROLE_PERMISSIONS]
    expect(granted.filter((name) => !ALL_PERMISSIONS.includes(name))).toEqual([])
  })
})
