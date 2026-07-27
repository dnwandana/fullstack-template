const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const

type DurationUnit = keyof typeof UNIT_MS

const isDurationUnit = (value: unknown): value is DurationUnit =>
  typeof value === "string" && value in UNIT_MS

/**
 * Parse a token-lifetime string into milliseconds.
 *
 * Grammar is `<digits><s|m|h|d>` — intentionally narrower than what @nestjs/jwt accepts.
 * The same value drives the JWT expiry, the refresh-token row, and the cookie maxAge, so
 * anything this parser cannot handle must fail loudly rather than fall back to a default
 * the other two consumers would not share.
 */
export function parseDuration(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value)
  const amount = match?.[1]
  const unit = match?.[2]
  // Both capture groups are mandatory and `[smhd]` is exactly `UNIT_MS`'s key set, so
  // these two extra checks cannot fire today. They are folded into the one existing
  // guard — rather than added as a second throw with a new message — so that widening
  // the regex without widening `UNIT_MS` still fails loudly here, as the contract above
  // requires, instead of multiplying by `undefined` and returning NaN.
  if (amount === undefined || !isDurationUnit(unit)) {
    throw new Error(`Invalid duration "${value}" — expected <number><s|m|h|d>, e.g. 15m or 7d`)
  }
  return parseInt(amount, 10) * UNIT_MS[unit]
}
