import HttpError from "../../src/utils/http-error.js"

describe("HttpError", () => {
  it("should create an error with default values", () => {
    const error = new HttpError()
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(HttpError)
    expect(error.status).toBe(400)
    expect(error.message).toBe("Bad Request")
    expect(error.name).toBe("HttpError")
  })

  it("should create an error with custom status and message", () => {
    const error = new HttpError(404, "Not Found")
    expect(error.status).toBe(404)
    expect(error.message).toBe("Not Found")
  })

  it("should have a stack trace", () => {
    const error = new HttpError(500, "Server Error")
    expect(error.stack).toBeDefined()
    expect(error.stack).toContain("HttpError")
  })
})
