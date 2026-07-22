/**
 * Builds the public URL an invitee opens to accept an invitation.
 *
 * Single source of truth for the link shape. The frontend route
 * (apps/app/src/router/index.js) must stay in sync with the path used here.
 *
 * @param {string} invitationId - UUID of the invitation
 * @param {string} rawToken - Raw 64-char hex invitation token
 * @returns {string} Absolute accept URL
 */
export const buildInvitationAcceptUrl = (invitationId, rawToken) => {
  const base = process.env.APP_BASE_URL.replace(/\/+$/, "")
  return `${base}/invite/${invitationId}?token=${rawToken}`
}
