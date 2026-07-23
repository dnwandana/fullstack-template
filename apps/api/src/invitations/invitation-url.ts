// Single source of truth for the accept-link shape. The SPA route
// (apps/app/src/router) must stay in sync with `${base}/invite/:id?token=<raw>`.
export function buildInvitationAcceptUrl(
  appBaseUrl: string,
  invitationId: string,
  rawToken: string,
): string {
  const base = appBaseUrl.replace(/\/+$/, "")
  return `${base}/invite/${invitationId}?token=${rawToken}`
}
