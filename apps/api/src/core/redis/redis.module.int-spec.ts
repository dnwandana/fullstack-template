import { Test } from "@nestjs/testing"
import { ConfigModule } from "@nestjs/config"
import type Redis from "ioredis"
import { RedisModule } from "./redis.module"
import { REDIS_CLIENT } from "./redis.constants"

describe("RedisModule", () => {
  let client: Redis

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), RedisModule],
    }).compile()
    client = moduleRef.get<Redis>(REDIS_CLIENT)
  })

  afterAll(async () => {
    await client.quit()
  })

  it("provides a connected client", async () => {
    expect(await client.ping()).toBe("PONG")
  })

  it("round-trips a value", async () => {
    await client.set("redis-module-int-spec", "ok")
    expect(await client.get("redis-module-int-spec")).toBe("ok")
    await client.del("redis-module-int-spec")
  })
})
