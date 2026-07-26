import { Test } from "@nestjs/testing"
import { INestApplication } from "@nestjs/common"
import request from "supertest"
import { AppModule } from "../src/app.module"
import { createTestApp } from "./create-test-app"
import { HealthService } from "../src/health/health.service"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe("GET /health", () => {
  let app: INestApplication
  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = await createTestApp(ref)
  })
  afterAll(async () => app.close())
  // Restore unconditionally: an inline restore at the end of a test is skipped when an
  // assertion above it throws, leaking the stub into every later test in the file.
  afterEach(() => jest.restoreAllMocks())

  it("returns healthy with uptime + database outside production", async () => {
    const res = await request(app.getHttpServer()).get("/health")
    expect(res.status).toBe(200)
    expect(res.body.message).toBe("healthy")
    expect(res.body.data.status).toBe("healthy")
    expect(res.body.data.database).toBe("ok")
    expect(typeof res.body.data.uptime).toBe("number")
    expect(res.body.data.timestamp).toBeDefined()
  })

  it("includes X-Request-Id", async () => {
    const res = await request(app.getHttpServer()).get("/health")
    expect(res.headers["x-request-id"]).toMatch(UUID)
  })

  it("is not rate limited across rapid requests", async () => {
    let res!: request.Response
    for (let i = 0; i < 5; i++) {
      res = await request(app.getHttpServer()).get("/health")
      expect(res.status).toBe(200)
    }
    expect(res.headers["x-ratelimit-limit-general"]).toBeUndefined()
  })

  it("serves liveness without the api prefix", async () => {
    const res = await request(app.getHttpServer()).get("/health/live")
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe("alive")
  })

  it("does not mount liveness under /api", async () => {
    const res = await request(app.getHttpServer()).get("/api/health/live")
    expect(res.status).toBe(404)
  })

  it("serves readiness without the api prefix", async () => {
    const res = await request(app.getHttpServer()).get("/health/ready")
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe("ready")
  })

  it("reports 503 from readiness when the database is unreachable", async () => {
    const health = app.get(HealthService)
    jest.spyOn(health, "check").mockResolvedValueOnce({ healthy: false, dbStatus: "error" })

    const res = await request(app.getHttpServer()).get("/health/ready")
    expect(res.status).toBe(503)
  })

  it("stays 200 on liveness when the database is unreachable", async () => {
    const health = app.get(HealthService)
    jest.spyOn(health, "check").mockResolvedValue({ healthy: false, dbStatus: "error" })

    const res = await request(app.getHttpServer()).get("/health/live")
    expect(res.status).toBe(200)
  })
})
