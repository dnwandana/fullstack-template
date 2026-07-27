export type PasswordResetJob = {
  kind: "password-reset"
  userId: string
  email: string
  rawToken: string
}

// Mirrors the parameter names of InvitationNotifierService.sendInvitationEmail
// one for one. `orgName` is carried even though nothing but a log line reads it
// today: the always-on line is `… queued for <email> (org: <orgName>)`, and a
// payload without it cannot reproduce that line — the org would silently vanish
// from the log the moment delivery moved off the request path.
export type InvitationJob = {
  kind: "invitation"
  invitationId: string
  email: string
  rawToken: string
  orgName: string
}

// A discriminated union, not a loose Record: the processor switches on `kind`,
// and an unhandled variant becomes a compile error via the exhaustiveness check
// rather than a job that is silently acknowledged and never acted on.
export type NotificationJob = PasswordResetJob | InvitationJob
