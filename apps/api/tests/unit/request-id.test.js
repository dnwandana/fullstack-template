import { vi, describe, it, expect, beforeEach } from "vitest"

describe("requestId middleware", () => {
  let req
  let res
  let next

  beforeEach(() => {
    req = { headers: {} }
    res = { setHeader: vi.fn() }
    next = vi.fn()
  })

  it("should generate a UUID when no incoming header", async () => {
    const { requestId } = await import("../../src/middlewares/request-id.js")
    requestId(req, res, next)

    expect(req.id).toBeDefined()
    expect(req.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", req.id)
    expect(next).toHaveBeenCalled()
  })

  it("should accept a valid UUID from incoming header", async () => {
    const { requestId } = await import("../../src/middlewares/request-id.js")
    const validUUID = "550e8400-e29b-41d4-a716-446655440000"
    req.headers["x-request-id"] = validUUID

    requestId(req, res, next)

    expect(req.id).toBe(validUUID)
    expect(next).toHaveBeenCalled()
  })

  it("should ignore and replace a non-UUID incoming header", async () => {
    const { requestId } = await import("../../src/middlewares/request-id.js")
    req.headers["x-request-id"] = "not-a-uuid"

    requestId(req, res, next)

    expect(req.id).not.toBe("not-a-uuid")
    expect(req.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(next).toHaveBeenCalled()
  })

  it("should ignore header with CRLF injection attempt", async () => {
    const { requestId } = await import("../../src/middlewares/request-id.js")
    req.headers["x-request-id"] = "abc\r\nX-Injected: true"

    requestId(req, res, next)

    expect(req.id).not.toContain("\r\n")
    expect(next).toHaveBeenCalled()
  })
})
