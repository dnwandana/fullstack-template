import { z } from "zod"
import { CONTROL_CHARS, email, plainSingleLine, queryInt } from "../fields"
import { formatIssues } from "../schema-validation.pipe"

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
 * The suite above tests the regex on its own, so it stays green if `plainSingleLine` stops
 * applying it, or if the trim is deleted. These tests drive the field inside an object, as a
 * DTO does, and read the message that the pipe sends.
 */
describe("plainSingleLine", () => {
  const schema = z.strictObject({ name: plainSingleLine(100) })
  const messages = (name: unknown): string[] => {
    const result = schema.safeParse({ name })
    return result.success ? [] : formatIssues(result.error.issues)
  }

  it("removes leading and trailing spaces", () => {
    expect(schema.parse({ name: "  Acme  " }).name).toBe("Acme")
  })

  it("leaves a value that has no padding", () => {
    expect(schema.parse({ name: "Acme" }).name).toBe("Acme")
  })

  it("rejects a non-string", () => {
    expect(messages(42)).toHaveLength(1)
  })

  it("accepts an ordinary name", () => {
    expect(messages("Acme Corporation")).toEqual([])
  })

  it("rejects a name that holds a control character and names the field", () => {
    expect(messages("Acme‮corp")).toEqual(["name: must not contain control characters"])
  })

  it("rejects a name that is only spaces, because the trim runs first", () => {
    expect(messages("   ")).toHaveLength(1)
  })

  it("rejects a name longer than the limit", () => {
    expect(messages("a".repeat(101))).toHaveLength(1)
  })
})

describe("email", () => {
  it("trims and lowercases the address before the check", () => {
    expect(email.parse("  ADA@X.IO ")).toBe("ada@x.io")
  })

  it("rejects an invalid address with the field-named message", () => {
    const result = z.strictObject({ email }).safeParse({ email: "nope" })
    expect(result.success).toBe(false)
    expect(formatIssues(result.error?.issues ?? [])).toEqual(["email must be a valid email"])
  })
})

describe("queryInt", () => {
  const limit = queryInt(10, 100)

  it("applies the default when the value is absent", () => {
    expect(limit.parse(undefined)).toBe(10)
  })

  it("coerces a numeric string", () => {
    expect(limit.parse("25")).toBe(25)
  })

  it.each(["abc", "0", "1.5", "101", ""])("rejects %j", (value) => {
    expect(limit.safeParse(value).success).toBe(false)
  })
})
