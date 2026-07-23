import { Test } from "@nestjs/testing"
import { INestApplication } from "@nestjs/common"
import request from "supertest"
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/bootstrap"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe("GET /health", () => {
  let app: INestApplication
  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = ref.createNestApplication({ bufferLogs: true })
    configureApp(app)
    await app.init()
  })
  afterAll(async () => app.close())

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
    let res
    for (let i = 0; i < 5; i++) {
      res = await request(app.getHttpServer()).get("/health")
      expect(res.status).toBe(200)
    }
    expect(res.headers["x-ratelimit-limit-general"]).toBeUndefined()
  })
})
