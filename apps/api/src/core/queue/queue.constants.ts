// The Redis key namespace for every notification job: BullMQ stores them under
// `bull:notifications:*`. Changing this string orphans any job already in flight,
// so it is a constant rather than an inline literal at each registration site.
export const NOTIFICATION_QUEUE = "notifications"
