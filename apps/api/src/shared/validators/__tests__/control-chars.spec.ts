import { plainToInstance } from "class-transformer"
import { validateSync } from "class-validator"
import { CONTROL_CHARS, IsPlainSingleLine } from "../control-chars"

describe("CONTROL_CHARS", () => {
  it("accepts an ordinary name", () => {
    expect(CONTROL_CHARS.test("Acme Corporation")).toBe(true)
  })

  it("rejects a right-to-left override", () => {
    expect(CONTROL_CHARS.test("Acme‮corp")).toBe(false)
  })

  it("rejects a left-to-right mark", () => {
    expect(CONTROL_CHARS.test("Acme‎corp")).toBe(false)
  })

  it("rejects an isolate", () => {
    expect(CONTROL_CHARS.test("Acme⁦corp")).toBe(false)
  })

  it("rejects a newline", () => {
    expect(CONTROL_CHARS.test("Acme\ncorp")).toBe(false)
  })

  it("rejects an empty string", () => {
    expect(CONTROL_CHARS.test("")).toBe(false)
  })
})

/**
 * The suite above tests the regex on its own, so it stays green if `IsPlainSingleLine` stops
 * applying it, or if the `Transform` that trims is deleted. These tests drive the decorator
 * itself. A local class is used rather than a real DTO, because `src/shared/` must not depend
 * on a feature module.
 */
describe("IsPlainSingleLine", () => {
  class Subject {
    @IsPlainSingleLine()
    name!: string
  }

  const build = (name: unknown): Subject => plainToInstance(Subject, { name })

  it("removes leading and trailing spaces", () => {
    expect(build("  Acme  ").name).toBe("Acme")
  })

  it("leaves a value that has no padding", () => {
    expect(build("Acme").name).toBe("Acme")
  })

  it("passes a non-string through the transform untouched", () => {
    expect(build(42).name).toBe(42)
  })

  it("accepts an ordinary name", () => {
    expect(validateSync(build("Acme Corporation"))).toHaveLength(0)
  })

  it("rejects a name that holds a control character", () => {
    const errors = validateSync(build("Acme‮corp"))
    expect(errors).toHaveLength(1)
    expect(errors[0]?.constraints?.matches).toBe("name must not contain control characters")
  })

  it("rejects a name that is only spaces, because the trim runs first", () => {
    expect(validateSync(build("   "))).toHaveLength(1)
  })
})
