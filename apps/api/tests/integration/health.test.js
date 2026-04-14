import { request, cleanAllTables } from "../helpers.js"

afterEach(async () => {
  await cleanAllTables()
})

describe("GET /health", () => {
  it("should return healthy status when database is connected", async () => {
    const res = await (await request()).get("/health")

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("healthy")
    expect(res.body.data.status).toBe("healthy")
    expect(res.body.data.database).toBe("ok")
    expect(res.body.data.uptime).toBeTypeOf("number")
    expect(res.body.data.timestamp).toBeDefined()
  })

  it("should include X-Request-Id header in response", async () => {
    const res = await (await request()).get("/health")

    expect(res.headers["x-request-id"]).toBeDefined()
    expect(res.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })

  it("should echo back a provided X-Request-Id", async () => {
    const customId = "my-custom-request-id-12345"
    const res = await (await request()).get("/health").set("x-request-id", customId)

    expect(res.headers["x-request-id"]).toBe(customId)
  })

  it("should not be rate limited", async () => {
    // Health check is registered before rate limiter
    // Send several requests quickly — none should be 429
    const agent = await request()
    for (let i = 0; i < 5; i++) {
      const res = await agent.get("/health")
      expect(res.status).toBe(200)
    }
  })
})
