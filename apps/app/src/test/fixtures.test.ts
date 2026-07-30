import { describe, it, expect } from "vitest"
import {
  makeInvitation,
  makeInvitationListItem,
  makeInvitationPreview,
  makeInvitationWithToken,
  makeMyInvitation,
  makeOrg,
  makeOrgMember,
  makePaginationMeta,
  makePermission,
  makeRole,
  makeTodo,
  makeUser,
  ok,
  okPaginated,
} from "./fixtures"

describe("core entity factories", () => {
  it("serializes Date fields as ISO strings, not Date objects", () => {
    expect(typeof makeTodo().updated_at).toBe("string")
    expect(makeOrg().created_at).not.toBeInstanceOf(Date)
  })

  it("applies overrides over the defaults", () => {
    expect(makeUser({ email: "grace@example.com" }).email).toBe("grace@example.com")
    expect(makeTodo({ is_completed: true }).is_completed).toBe(true)
  })

  it("returns deterministic values so failures reproduce", () => {
    expect(makeOrg()).toEqual(makeOrg())
  })
})

describe("role, member and pagination factories", () => {
  it("makeRole returns every key the Role contract declares", () => {
    expect(Object.keys(makeRole()).sort()).toEqual(
      [
        "created_at",
        "description",
        "id",
        "is_system",
        "name",
        "org_id",
        "permissions",
        "updated_at",
      ].sort(),
    )
  })

  it("nests permissions inside a role", () => {
    const role = makeRole({ permissions: [makePermission({ name: "todos:write" })] })
    expect(role.permissions[0].name).toBe("todos:write")
  })

  it("distinguishes org members from project members", () => {
    expect(makeOrgMember()).toHaveProperty("org_id")
    expect(makeOrgMember()).not.toHaveProperty("project_id")
  })

  it("makePaginationMeta nulls the boundary pages", () => {
    const p = makePaginationMeta()
    expect(p.previous_page).toBeNull()
    expect(p.next_page).toBeNull()
  })
})

describe("invitation factories", () => {
  it("builds the supersets from the base row", () => {
    for (const key of Object.keys(makeInvitation())) {
      expect(makeInvitationListItem()).toHaveProperty(key)
      expect(makeMyInvitation()).toHaveProperty(key)
      expect(makeInvitationWithToken()).toHaveProperty(key)
    }
  })

  it("keeps the public preview a narrow projection, not a superset", () => {
    const preview = makeInvitationPreview()
    // org_id / inviter_id / role_id are withheld from logged-out callers by design.
    expect(preview).not.toHaveProperty("org_id")
    expect(preview).not.toHaveProperty("inviter_id")
    expect(preview).not.toHaveProperty("role_id")
    expect(preview).toHaveProperty("requires_signup")
    expect(preview).toHaveProperty("is_expired")
  })

  it("returns the raw token only on the with-token variant", () => {
    expect(makeInvitationWithToken().token).toHaveLength(64)
    expect(makeInvitation()).not.toHaveProperty("token")
  })
})

describe("envelope helpers", () => {
  it("nests the payload two levels deep and supplies status", () => {
    const res = ok(makeRole({ name: "Admin" }))
    expect(res.status).toBe(200)
    expect(res.data.data.name).toBe("Admin")
    expect(res.data.message).toBe("OK")
  })

  it("okPaginated always carries pagination", () => {
    const res = okPaginated([makeTodo()])
    expect(res.data.data).toHaveLength(1)
    expect(res.data.pagination.current_page).toBe(1)
  })

  it("okPaginated derives total_items from the rows but honours overrides", () => {
    expect(okPaginated([makeTodo(), makeTodo()]).data.pagination.total_items).toBe(2)
    expect(okPaginated([makeTodo()], { total_items: 99 }).data.pagination.total_items).toBe(99)
  })

  it("ok carries a null payload for deletes", () => {
    expect(ok(null).data.data).toBeNull()
  })
})
