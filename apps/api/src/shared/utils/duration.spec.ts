import { parseDuration } from "./duration"

describe("parseDuration", () => {
  it.each([
    ["30s", 30_000],
    ["15m", 900_000],
    ["1h", 3_600_000],
    ["7d", 604_800_000],
  ])("parses %s", (input, expected) => {
    expect(parseDuration(input as string)).toBe(expected)
  })

  // "1w" is rejected on purpose: @nestjs/jwt would accept it, which would mint a 7-day
  // JWT while this parser throws. Do not "fix" it.
  it.each(["7days", "1w", "", "m15", "-5m", "1.5h", "15 m"])("rejects %s", (input) => {
    expect(() => parseDuration(input)).toThrow(/Invalid duration/)
  })
})
