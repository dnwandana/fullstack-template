import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type Redis from "ioredis"
import { AppModule } from "../src/app.module"
import { REDIS_CLIENT } from "@core/redis/redis.constants"
import { createTestApp } from "./create-test-app"
import { flushRedis } from "./setup-e2e"

describe("redis isolation", () => {
  let app: INestApplication
  let redis: Redis

  beforeAll(async () => {
    // createTestApp takes a compiled TestingModule — it does not build one.
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = await createTestApp(ref)
    redis = app.get<Redis>(REDIS_CLIENT)
  })

  afterAll(async () => {
    await app.close()
  })

  it("leaves no keys behind", async () => {
    await redis.set("leftover-from-a-previous-suite", "1")
    await flushRedis(redis)
    expect(await redis.keys("*")).toHaveLength(0)
  })

  it("targets a dedicated test database, not db 0", async () => {
    // .env.test pins REDIS_URL to db 1. Flushing db 0 from a test run would wipe
    // a developer's local queue and rate-limit state with no warning. This is the
    // only automated guard on flushRedis, which is destructive by construction.
    expect(process.env.REDIS_URL).toMatch(/\/1$/)
  })
})
