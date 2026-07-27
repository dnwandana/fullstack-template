/**
 * Redis key namespace for every notification job (`bull:notifications:*`). Changing this string
 * orphans any job already in flight, so it is a constant rather than a literal repeated at each
 * registration site.
 */
export const NOTIFICATION_QUEUE = "notifications"
