const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const

type DurationUnit = keyof typeof UNIT_MS

const isDurationUnit = (value: unknown): value is DurationUnit =>
  typeof value === "string" && value in UNIT_MS

/**
 * Parse a token-lifetime string into milliseconds; throws on anything else. Grammar
 * `<digits><s|m|h|d>` is intentionally narrower than @nestjs/jwt's: one value drives the JWT
 * expiry, the refresh-token row and the cookie maxAge, so a fallback default desyncs all three.
 */
export function parseDuration(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value)
  const amount = match?.[1]
  const unit = match?.[2]
  // Unreachable today: both groups are mandatory and `[smhd]` is exactly `UNIT_MS`'s key set.
  // Folded into the one existing throw, not a second one, so that widening the regex without
  // widening `UNIT_MS` still fails loudly here, as the contract above requires, not returning NaN.
  if (amount === undefined || !isDurationUnit(unit)) {
    throw new Error(`Invalid duration "${value}" — expected <number><s|m|h|d>, e.g. 15m or 7d`)
  }
  return parseInt(amount, 10) * UNIT_MS[unit]
}
