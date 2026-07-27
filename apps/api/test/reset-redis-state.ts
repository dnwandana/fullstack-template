import Redis from "ioredis"
import { flushRedis } from "./setup-e2e"

// Rate-limit counters used to live inside each app instance, so every spec file's
// freshly compiled AppModule started with an empty limiter. They now live in
// Redis, which is process-external and shared by every suite in a `--runInBand`
// run — and, because the counters carry a 15-minute TTL, by consecutive runs too.
// A full e2e pass signs up and signs in far more than RATE_LIMIT_AUTH_MAX times,
// and that value is Joi-capped at 50, so it cannot simply be raised in .env.test.
// Reset the counters between tests the same way truncateAll resets the database.
//
// This file is the ONE place that happens. It is registered as
// `setupFilesAfterEnv` in test/jest-e2e.json, so the beforeEach below is a root
// hook: it runs before every test in every e2e suite, and no suite calls a reset
// of its own. If you are looking for what clears a throttle counter between
// tests, this hook is the whole answer.
//
// It resets by whole-database flush rather than by deleting the throttler's key
// patterns (it used to match `{*}:hits` and `{*}:blocked`, the key layout of
// @nest-lab/throttler-storage-redis). Redis now holds a second kind of
// cross-suite state — BullMQ's `bull:notifications:*` job hashes — and a pattern
// list that has to be kept in step with two libraries' key layouts is a
// silent-drift hazard: a renamed key stops being matched and nothing fails until
// an unrelated suite does. The connection is pinned to db 1 by .env.test, so the
// blast radius of the flush is exactly the data this run owns. flushRedis is the
// shared spelling of that operation and carries the flushdb-not-flushall
// reasoning; see test/setup-e2e.ts.
let client: Redis | undefined

function redis(): Redis {
  if (client === undefined) {
    const url = process.env.REDIS_URL
    if (url === undefined || url === "") {
      throw new Error("REDIS_URL is not set — test/load-test-env.ts should have loaded .env.test")
    }
    // A connection of its own, not the app's REDIS_CLIENT: this hook runs before
    // any test has built a Nest application, and it must also work for the specs
    // that never build one.
    client = new Redis(url, { maxRetriesPerRequest: null })
  }
  return client
}

beforeEach(async () => {
  await flushRedis(redis())
})

// Without this the open socket keeps Jest alive after the suite finishes.
afterAll(async () => {
  await client?.quit()
  client = undefined
})
