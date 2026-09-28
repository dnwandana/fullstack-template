import { formatDate, formatDateTime, formatMemberCount } from "@/utils/format"

describe("formatDate", () => {
  it("formats an ISO string as a short month, day and year", () => {
    expect(formatDate("2026-09-26T14:32:00.000Z")).toBe("Sep 26, 2026")
  })

  it.each([null, undefined, "", "not-a-date"])("returns an em dash for %s", (value) => {
    expect(formatDate(value)).toBe("—")
  })
})

describe("formatDateTime", () => {
  it("adds the time on a 24-hour clock", () => {
    expect(formatDateTime("2026-09-26T14:32:00.000Z")).toBe("Sep 26, 2026, 14:32")
  })

  it("pads the hour after midnight", () => {
    expect(formatDateTime("2026-09-26T00:05:00.000Z")).toBe("Sep 26, 2026, 00:05")
  })

  it.each([null, undefined, "", "not-a-date"])("returns an em dash for %s", (value) => {
    expect(formatDateTime(value)).toBe("—")
  })
})

describe("formatMemberCount", () => {
  it.each([
    [0, "0 members"],
    [1, "1 member"],
    [6, "6 members"],
  ])("formats %i as %s", (count, text) => {
    expect(formatMemberCount(count)).toBe(text)
  })
})
