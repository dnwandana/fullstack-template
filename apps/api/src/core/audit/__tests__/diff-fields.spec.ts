import { diffFields } from "../diff-fields"

describe("diffFields", () => {
  it("returns from/to pairs for changed keys only", () => {
    const before = { title: "a", description: "same", is_completed: false }
    const after = { title: "b", description: "same", is_completed: true }
    expect(diffFields(before, after, ["title", "description", "is_completed"])).toEqual({
      title: { from: "a", to: "b" },
      is_completed: { from: false, to: true },
    })
  })

  it("returns null when nothing changed", () => {
    const row = { name: "Acme", description: null }
    expect(diffFields(row, { ...row }, ["name", "description"])).toBeNull()
  })

  it("treats null-to-value as a change", () => {
    expect(diffFields({ description: null }, { description: "x" }, ["description"])).toEqual({
      description: { from: null, to: "x" },
    })
  })

  it("compares array values by content", () => {
    const before = { permission_ids: ["a", "b"] }
    const same = { permission_ids: ["a", "b"] }
    const changed = { permission_ids: ["a", "c"] }
    expect(diffFields(before, same, ["permission_ids"])).toBeNull()
    expect(diffFields(before, changed, ["permission_ids"])).toEqual({
      permission_ids: { from: ["a", "b"], to: ["a", "c"] },
    })
  })

  it("ignores keys outside the whitelist", () => {
    const before = { name: "x", secret: "old" }
    const after = { name: "x", secret: "new" }
    expect(diffFields(before, after, ["name"])).toBeNull()
  })
})
