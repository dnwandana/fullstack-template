const UNIT_MS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }

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
  if (!match) {
    throw new Error(`Invalid duration "${value}" — expected <number><s|m|h|d>, e.g. 15m or 7d`)
  }
  return parseInt(match[1], 10) * UNIT_MS[match[2]]
}
