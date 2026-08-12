import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type Redis from "ioredis"
import request from "supertest"
import { AppModule } from "../../src/app.module"
import { REDIS_CLIENT } from "@core/redis/redis.constants"
import { createTestApp } from "../create-test-app"
import { flushRedis } from "../setup-e2e"

// @nest-lab/throttler-storage-redis keeps each counter in a plain string key that
// its Lua script INCRs, named `{<guard-generated-key>:<throttler-name>}:hits`. The
// braces are a Redis Cluster hash tag, so the counter and its sibling `:blocked`
// key (written only once a limit is exceeded) always hash to the same slot. Match
// only `:hits` here: `:blocked` holds a flag of 1, not a request count, and summing
// it in would inflate the total.
const HITS_KEY = /^\{.+:general\}:hits$/

describe("Throttler storage (e2e)", () => {
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

  const hitKeys = async (): Promise<string[]> =>
    (await redis.keys("*")).filter((key) => HITS_KEY.test(key))

  // The root beforeEach in test/reset-redis-state.ts has already emptied the
  // database before each case here. These flushes are not that reset repeated:
  // they re-establish a known-empty starting point *after* the setup above, so
  // the key counts below measure only what the requests in this case wrote. Going
  // through flushRedis keeps one spelling of the operation across the suite.
  it("records throttle counters in Redis, not in process memory", async () => {
    await flushRedis(redis)
    await request(app.getHttpServer()).get("/api/v1/permissions")

    // ThrottlerGuard is registered before JwtAuthGuard, so the counter is
    // incremented and only then does auth reject — an unauthenticated 401 still
    // counts. With the default in-memory store nothing reaches Redis at all.
    expect(await hitKeys()).toHaveLength(1)
  })

  it("counts N requests into one shared counter of N", async () => {
    await flushRedis(redis)
    for (let i = 0; i < 3; i += 1) {
      await request(app.getHttpServer())
        .post("/api/v1/auth/signin")
        .send({ email: "nobody@example.com", password: "wrong-password" })
    }

    const keys = await hitKeys()
    expect(keys).toHaveLength(1)
    const counters = await Promise.all(keys.map(async (key) => Number(await redis.get(key))))
    const total = counters.reduce((sum, value) => sum + value, 0)
    expect(total).toBe(3)
  })
})
