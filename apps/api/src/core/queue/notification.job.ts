export type PasswordResetJob = {
  kind: "password-reset"
  userId: string
  email: string
  rawToken: string
}

/**
 * Mirrors InvitationNotifierService.sendInvitationEmail's parameters one for one. `orgName` is
 * carried only for the always-on log line `… queued for <email> (org: <orgName>)`; without it the
 * org silently vanishes from that line now that delivery runs off the request path.
 */
export type InvitationJob = {
  kind: "invitation"
  invitationId: string
  email: string
  rawToken: string
  orgName: string
}

/**
 * A discriminated union, not a loose Record: the processor switches on `kind`, so an unhandled
 * variant becomes a compile error via the exhaustiveness check rather than a job that is
 * silently acknowledged and never acted on.
 */
export type NotificationJob = PasswordResetJob | InvitationJob
