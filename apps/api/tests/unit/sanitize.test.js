import { escapeIlike } from "../../src/utils/sanitize.js"

describe("escapeIlike", () => {
  it("should return normal strings unchanged", () => {
    expect(escapeIlike("hello world")).toBe("hello world")
  })

  it("should escape percent signs", () => {
    expect(escapeIlike("100%")).toBe("100\\%")
  })

  it("should escape underscores", () => {
    expect(escapeIlike("some_value")).toBe("some\\_value")
  })

  it("should escape backslashes", () => {
    expect(escapeIlike("path\\to")).toBe("path\\\\to")
  })

  it("should escape all special characters in one string", () => {
    expect(escapeIlike("50%_off\\sale")).toBe("50\\%\\_off\\\\sale")
  })

  it("should handle empty string", () => {
    expect(escapeIlike("")).toBe("")
  })
})
