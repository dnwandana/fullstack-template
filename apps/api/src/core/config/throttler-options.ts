import { Logger } from "@nestjs/common"
import type { ConfigService } from "@nestjs/config"
import type { ThrottlerModuleOptions } from "@nestjs/throttler"
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis"
import type Redis from "ioredis"

// The object form, not the bare array: an array has nowhere to put `storage`,
// and an array carrying a stray `storage` key is silently ignored.
type ThrottlerOptionsObject = Extract<ThrottlerModuleOptions, { throttlers: unknown }>

/**
 * Builds the ThrottlerModule options from the validated config. Returns a `skipIf` that skips
 * every throttler when THROTTLE_DISABLED is "true".
 */
export function buildThrottlerOptions(config: ConfigService, redis: Redis): ThrottlerOptionsObject {
  const disabled = config.getOrThrow<string>("THROTTLE_DISABLED") === "true"
  if (disabled) {
    new Logger("Throttler").warn(
      "Rate limits are off (THROTTLE_DISABLED=true). Use this only for local e2e runs.",
    )
  }
  return {
    // Counters in Redis so the limit belongs to the deployment, not to each process: the
    // default in-memory store gives N replicas N independent counters and an effective limit
    // of N x max — including the auth lockout that exists to slow credential stuffing.
    storage: new ThrottlerStorageRedisService(redis),
    throttlers: [
      {
        name: "general",
        ttl: 15 * 60 * 1000,
        // Via ConfigService, not process.env: the factory runs after ConfigModule validation,
        // so the env schema's coercion and default apply by construction. The old inline
        // `Number(process.env.X ?? 100)` yielded NaN on a reorder — throttling silently off.
        limit: config.getOrThrow<number>("RATE_LIMIT_GENERAL_MAX"),
      },
    ],
    // A module-level `skipIf` also covers the `@Throttle` override on `AuthController`.
    skipIf: () => disabled,
  }
}
