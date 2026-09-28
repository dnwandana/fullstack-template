import { ConfigService } from "@nestjs/config"
import { Logger } from "@nestjs/common"
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host"
import Redis from "ioredis"
import { buildThrottlerOptions } from "../throttler-options"

const configWith = (throttleDisabled: "true" | "false") =>
  new ConfigService({ RATE_LIMIT_GENERAL_MAX: 1000, THROTTLE_DISABLED: throttleDisabled })

describe("buildThrottlerOptions", () => {
  const redis = new Redis({ lazyConnect: true })
  const context = new ExecutionContextHost([])

  afterAll(() => redis.disconnect())
  afterEach(() => jest.restoreAllMocks())

  it("keeps one general throttler of 15 minutes", () => {
    const options = buildThrottlerOptions(configWith("false"), redis)
    expect(options.throttlers).toEqual([{ name: "general", ttl: 900000, limit: 1000 }])
  })

  it("skips nothing and logs nothing when the flag is false", () => {
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined)
    const options = buildThrottlerOptions(configWith("false"), redis)
    expect(options.skipIf?.(context)).toBe(false)
    expect(warn).not.toHaveBeenCalled()
  })

  it("skips every request and warns once when the flag is true", () => {
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined)
    const options = buildThrottlerOptions(configWith("true"), redis)
    expect(options.skipIf?.(context)).toBe(true)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      "Rate limits are off (THROTTLE_DISABLED=true). Use this only for local e2e runs.",
    )
  })
})
