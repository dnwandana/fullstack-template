import Redis from "ioredis"
import { flushRedis } from "./setup-e2e"

// Throttle counters and BullMQ job hashes live in Redis, which is process-external and shared
// by every suite in a `--runInBand` run (counters carry a 15-minute TTL, so by consecutive runs
// too): without a reset a full e2e pass exceeds RATE_LIMIT_AUTH_MAX, Joi-capped at 50.
let client: Redis | undefined

function redis(): Redis {
  if (client === undefined) {
    const url = process.env.REDIS_URL
    if (url === undefined || url === "") {
      throw new Error("REDIS_URL is not set — test/load-test-env.ts should have loaded .env.test")
    }
    // A connection of its own, not the app's REDIS_CLIENT: this hook runs before any test has
    // built a Nest application, and must also work for the specs that never build one.
    client = new Redis(url, { maxRetriesPerRequest: null })
  }
  return client
}

// Registered as `setupFilesAfterEnv` in test/jest-e2e.json, so this beforeEach is a root hook:
// it runs before every test in every e2e suite, no suite resets counters of its own, and this
// file is the whole answer to "what clears a throttle counter between tests".

// Whole-database flushdb (never flushall) rather than key patterns: a list kept in step with
// two libraries' key layouts drifts — a renamed key stops matching and nothing fails until an
// unrelated suite does. .env.test pins db 1, so the flush's blast radius is this run's data.
beforeEach(async () => {
  await flushRedis(redis())
})

// Without this the open socket keeps Jest alive after the suite finishes.
afterAll(async () => {
  await client?.quit()
  client = undefined
})
