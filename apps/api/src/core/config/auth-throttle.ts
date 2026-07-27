// @Throttle() arguments are evaluated at import time, before the DI container —
// and therefore before Joi validation — exists. This is the one config read that
// cannot go through ConfigService. Mirror Joi's constraints (int, 1..50, default
// 10) and FAIL FAST on garbage: the old `Number(x ?? 10)` yielded NaN, which the
// throttler treats as no limit at all.
export function authThrottleLimit(): number {
  const raw = process.env.RATE_LIMIT_AUTH_MAX
  if (raw === undefined || raw === "") return 10
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
    throw new Error(`RATE_LIMIT_AUTH_MAX must be an integer between 1 and 50, got "${raw}"`)
  }
  return parsed
}
