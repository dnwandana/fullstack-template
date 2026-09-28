/** Date display for the whole app. Uses the browser's local timezone. */

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" })

// hourCycle "h23" gives "00:05" after midnight. hour12: false gives "24:05" in some engines.
const DATE_TIME = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

/** Returns a Date, or null when the value is empty or unparsable. */
function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Returns "Sep 26, 2026", or an em dash when there is no valid date. */
export function formatDate(value: string | null | undefined): string {
  const date = toDate(value)
  return date ? DATE.format(date) : "—"
}

/** Returns "Sep 26, 2026, 14:32", or an em dash when there is no valid date. */
export function formatDateTime(value: string | null | undefined): string {
  const date = toDate(value)
  return date ? DATE_TIME.format(date) : "—"
}

/** Returns "1 member" or "N members". */
export function formatMemberCount(count: number): string {
  return `${count} ${count === 1 ? "member" : "members"}`
}
