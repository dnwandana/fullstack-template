/**
 * Single source of truth for the accept-link shape: `${base}/invite/:id?token=<raw>`, built from
 * the raw token, not its hash. The SPA route in apps/app/src/router must stay in sync with it.
 */
export function buildInvitationAcceptUrl(
  appBaseUrl: string,
  invitationId: string,
  rawToken: string,
): string {
  const base = appBaseUrl.replace(/\/+$/, "")
  return `${base}/invite/${invitationId}?token=${rawToken}`
}
